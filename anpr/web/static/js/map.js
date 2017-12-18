console.log("start of map.js");

var map;
var svg;
var svg_grp;

var trace_len = 20;
var data_chunks = [];

var transform = d3.geoTransform({point: projectPoint});
var path_gen = d3.geoPath().projection(transform);


function initmap() {
    console.log("initmap()");
    // set up the map
    map = new L.Map('mapid');

    // create the tile layer with correct attribution
    var osmUrl='http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    var osmAttrib='Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
    var osm = new L.TileLayer(osmUrl, {minZoom: 12, maxZoom: 14, attribution: osmAttrib});

    // start the map in Cambridge
    map.setView(new L.LatLng(52.205, 0.121),13);
    map.addLayer(osm);

    svg = d3.select(map.getPanes().overlayPane).append("svg");
    svg.attr("id", "svg_layer");
    svg_grp = svg.append("g").attr("class", "leaflet-zoom-hide");

    setTimeout(function(){load_chunk_for_hour(0);}, 5000);

    map.on("viewreset", reset);
    map.on("zoomend", reset);
    reset();
}

window.onload = initmap;

// Reposition the SVG to cover the features.
function reset() {
    console.log("reset()");
    if (data_chunks.length == 0) {
        return;
    }

    var bounds = path_gen.bounds(data_chunks[0]),
        topLeft = bounds[0],
        bottomRight = bounds[1];

    svg .attr("width", bottomRight[0] - topLeft[0])
        .attr("height", bottomRight[1] - topLeft[1])
        .style("left", topLeft[0] + "px")
        .style("top", topLeft[1] + "px");

    svg_grp .attr(
        "transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

    svg_grp.selectAll("path").attr("d", path_gen);
}

function load_chunk_for_hour(hour) {
    console.log("starting load");
    d3.json("/api/by-hour/day0/0/data.geojson", function(data){
        console.log("Loaded geojson");
        data_chunks.push(data);

        var feature = svg_grp.selectAll("path")
            .data(data.features)
            .enter().append("path")
                .attr("d", path_gen)
                .classed("trip_path", true);

        reset();
        svg.selectAll("path").each(transition);
    });
}

function transition(d, i, nodes) {
    var path = d3.select(this);
    path.attr("stroke-dasharray", trace_len + "," + this.getTotalLength());
    path.attr("stroke-dashoffset", trace_len);
    path.transition()
        .duration(60000)
        .ease(d3.easeLinear)
        .attrTween("stroke-dashoffset", tweenDash);
        //.on("end", function() { d3.select(this).call(transition); });// infinite loop
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

// Use Leaflet to implement a D3 geometric transformation.
function projectPoint(x, y) {
    var point = map.latLngToLayerPoint(new L.LatLng(y, x));
    this.stream.point(point.x, point.y);
}
