var map;
var svg;

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
    }

    map.on("viewreset", reset);
    map.on("zoomend", reset);
    reset();

    // Use Leaflet to implement a D3 geometric transformation.
    function projectPoint(x, y) {
        var point = map.latLngToLayerPoint(new L.LatLng(y, x));
        this.stream.point(point.x, point.y);
    }
}

window.onload = initmap;
