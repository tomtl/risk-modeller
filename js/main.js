mapboxgl.accessToken = 'pk.eyJ1IjoidHRsZWU0IiwiYSI6ImNrNjBwd3pmaTBhbmwzZ2w2bDdyeDcyYW0ifQ.1cscNlBBjYXqedUM8c4ELw';

var map = new mapboxgl.Map({
    container: 'map', // container id
    style: 'mapbox://styles/mapbox/streets-v11', // stylesheet location
    center: [-90.0, 44.8], // starting position [lng, lat],
    zoom: 6 // starting zoom
});

// setup data source
// https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson
// https://docs.mapbox.com/mapbox-gl-js/api/?size=n_10_n#map#addsource
map.on('load', function(){
    map.addSource('census-tracts', {
        "type": "geojson",
        "data": "data/cancer_tracts/cancer_tracts.geojson"
    });
    map.addSource('well-points', {
        "type": "geojson",
        "data": "data/well_nitrate/well_nitrate.geojson"
    });
    map.addLayer({
        // https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/
        "id": "census-tracts",
        "source": "census-tracts",
        "type": "line"
    });
    map.addLayer({
        "id": "well-points",
        "source": "well-points",
        "type": "circle"
    });
});
