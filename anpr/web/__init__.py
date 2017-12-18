import os
import datetime

from waitress import serve
from pyramid.config import Configurator
from pyramid.response import Response, FileResponse
from pyramid.static import static_view
from pyramid.view import view_config
import pyramid.renderers
import geojson
import psycopg2 as psy


SQL_DT_FMT = "2017-06-10 {hour:02d}:00:00+01"


@view_config(route_name='main', request_method='GET')
def main_view(request):
    here = os.path.dirname(__file__)
    page = os.path.join(here, "index.html")
    return FileResponse(page, request)


class ApiView:
    def __init__(self, request):
        self.request = request
        self.settings = request.registry.settings
        self.day = request.matchdict["day"]
        self.hour_start = int(request.matchdict["hour"])
        if not 0 <= self.hour_start <= 23:
            raise ValueError("Hour must be between 0 and 23 inclusive")
        self.hour_end = self.hour_start + 1

    @view_config(route_name="trip_geojson", renderer="geojson")
    def trip_geojson(self):
        features = []
        collection = geojson.FeatureCollection(features=features)
        with make_connection(self.settings) as conn:
            # Use a named cursor to create it server-side, which enables
            # chunked fetching of the results.
            with conn.cursor(name="trips") as cur:
                cur.execute(
"""
with ordered_cap as (
    select cap.id, cap.vehicle, veh.class, cap.ts, cap.camera, cam.location
    from captures as cap
    join (
        select distinct vehicle, min(ts) over (partition by vehicle) as ts
        from captures
        order by ts
    ) as trip_start on trip_start.vehicle = cap.vehicle and trip_start.ts < %s
    join cameras as cam on cam.id = cap.camera
    join vehicles as veh on cap.vehicle = veh.id
    order by vehicle, ts
    --limit 1000
),

cap_with_deltas as (
    -- Calculates the distance and time deltas between each point on a journey.
    select cap.id, cap.vehicle, cap.class, cap.ts,
    extract(epoch from
        coalesce(
            age(
                cap.ts,
                lag(cap.ts) over (partition by cap.vehicle order by cap.id)),
            '0 seconds'::interval)) as seconds_delta,
    cap.camera, cap.location,
    coalesce(ST_DistanceSphere(
                         cap.location,
                         lag(cap.location) over (partition by cap.vehicle order by cap.id)),
             0.) as dist_delta
    from ordered_cap as cap
    order by cap.vehicle, cap.ts
),

cap_cum as (
    -- Calculates the cumulative distance and time over a journey.
    select cap.id, cap.vehicle, cap.class, cap.ts, cap.seconds_delta,
        sum(cap.seconds_delta) over (partition by cap.vehicle order by cap.ts) as cum_seconds,
        cap.camera, cap.location, cap.dist_delta,
        sum(cap.dist_delta) over (partition by cap.vehicle order by cap.ts) as cum_dist
    from cap_with_deltas as cap
    order by cap.vehicle, cap.ts
)

select vehicle, class, ST_AsGeoJSON(ST_MakeLine(location order by ts)),
    array_agg(ts order by ts) as timestamps,
    array_agg(cum_seconds order by ts) as cum_seconds,
    array_agg(cum_dist order by ts) as cum_metres
from cap_cum as cap
group by vehicle, class
order by vehicle;
""",
                (SQL_DT_FMT.format(hour=self.hour_end),)
                )

                # import itertools
                # def pairwise(seq):
                #     "s -> (s0,s1), (s1,s2), (s2, s3), ..."
                #     a, b = itertools.tee(seq)
                #     next(b, None)
                #     return zip(a, b)

                for veh_id, veh_class, trip_line, timestamps, cum_seconds, \
                        cum_metres in cur:
                    # trip_duration_ts = (timestamps[-1] - timestamps[0]).total_seconds()
                    # trip_duration_cs = cum_seconds[-1]
                    # trip_duration_err = abs(trip_duration_cs - trip_duration_ts)
                    # try:
                    #     assert len(timestamps) == len(cum_seconds) == len(cum_metres)
                    #     for l, r in pairwise(timestamps):
                    #         assert l < r, "derp"
                    #     for l, r in pairwise(cum_seconds):
                    #         assert l < r, "derp"
                    #     for l, r in pairwise(cum_metres):
                    #         assert l <= r, "derp"
                    #     assert trip_duration_err < 1, "Trip duration error for vehicle id {} is {}".format(veh_id, trip_duration_err)
                    # except Exception:
                    #     import pdb
                    #     pdb.post_mortem()

                    # This trip started n seconds after the o'clock.
                    start_offset = (timestamps[0].minute * 60) + timestamps[0].second
                    properties = {
                        "vehicle_type": veh_class,
                        # "timestamps": timestamps,
                        "start_offset": start_offset,
                        "trip_cum_metres": cum_metres,
                        "trip_cum_seconds": cum_seconds
                    }
                    feature = geojson.Feature(
                        id=veh_id,
                        geometry=geojson.loads(trip_line),
                        properties=properties)
                    features.append(feature)

        return collection


def make_connection(settings):
    conn = psy.connect(
        dbname=settings["dbname"],
        user=settings["user"],
        password=settings["password"])
    return conn


def start(args):
    settings = dict(args.__dict__)
    with Configurator(settings=settings) as config:
        config.add_route("main", "/")
        config.add_static_view(name='static', path='anpr.web:static')

        config.add_route(
            "trip_geojson",
            "/api/by-hour/{day}/{hour}/data.geojson")

        geojson_renderer = pyramid.renderers.JSON(serializer=geojson.dumps)
        def datetime_adapter(obj, request):
            return obj.isoformat()
        geojson_renderer.add_adapter(datetime.datetime, datetime_adapter)
        config.add_renderer(
            name="geojson",
            factory=geojson_renderer)

        config.scan("anpr.web")
        app = config.make_wsgi_app()
    serve(app, host='127.0.0.1', port=8000)
