var map;
var svg;
var trace_len = 20;

var geo_data = {
    "type": "FeatureCollection",
    "features": [{
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [
                    0.1246635,52.2055937
                ],
                [
                    0.12147,52.2071275
                ],
                [
                    0.1133752,52.1979725
                ]
            ]
        }
    }]
}

function initmap() {
    // set up the map
    map = new L.Map('mapid');

    // create the tile layer with correct attribution
    var osmUrl='http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    var osmAttrib='Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
    var osm = new L.TileLayer(osmUrl, {minZoom: 12, maxZoom: 14, attribution: osmAttrib});

    // start the map in Cambridge
    map.setView(new L.LatLng(52.205, 0.121),14);
    map.addLayer(osm);

    svg = d3.select(map.getPanes().overlayPane).append("svg");
    svg.attr("id", "svg_layer");
    var g = svg.append("g").attr("class", "leaflet-zoom-hide");

    var transform = d3.geoTransform({point: projectPoint});
    var path = d3.geoPath().projection(transform);

    // Use Leaflet to implement a D3 geometric transformation.
    function projectPoint(x, y) {
        var point = map.latLngToLayerPoint(new L.LatLng(y, x));
        this.stream.point(point.x, point.y);
    }

    var feature = g.selectAll("path")
        .data(geo_data.features)
        .enter().append("path");


    // Reposition the SVG to cover the features.
    function reset() {
        var bounds = path.bounds(geo_data),
            topLeft = bounds[0],
            bottomRight = bounds[1];

        svg .attr("width", bottomRight[0] - topLeft[0])
            .attr("height", bottomRight[1] - topLeft[1])
            .style("left", topLeft[0] + "px")
            .style("top", topLeft[1] + "px");

        g   .attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

        feature.attr("d", path);
        feature.classed("trip_path", true);
    }

    map.on("viewreset", reset);
    map.on("zoomend", reset);
    reset();

    svg.select("path").call(transition);
}

window.onload = initmap;

function transition(path) {
    path.attr("stroke-dasharray", trace_len + "," + path.node().getTotalLength());
    path.attr("stroke-dashoffset", trace_len);
    path.transition()
        .duration(7500)
        .ease(d3.easeLinear)
        .attrTween("stroke-dashoffset", tweenDash)
        .on("end", function() { d3.select(this).call(transition); });// infinite loop
}

function tweenDash() {
    // `this` is an svg->g->path
    var len = this.getTotalLength();
    var i = d3.interpolateNumber(trace_len, -(len - trace_len));
    return i;
    /*
    return function(t) {
        var marker = d3.select("#marker");
        var p = path.node().getPointAtLength(t * l);
        marker.attr("transform", "translate(" + p.x + "," + p.y + ")");//move marker
        return i(t);
    }
    */
}
