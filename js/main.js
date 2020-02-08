mapboxgl.accessToken = 'pk.eyJ1IjoidHRsZWU0IiwiYSI6ImNrNjBwd3pmaTBhbmwzZ2w2bDdyeDcyYW0ifQ.1cscNlBBjYXqedUM8c4ELw';

var map = new mapboxgl.Map({
    container: 'map', // container id
    // style: 'mapbox://styles/mapbox/streets-v11', // stylesheet location
    style: 'mapbox://styles/mapbox/dark-v10',
    center: [-90.0, 44.8], // starting position [lng, lat],
    zoom: 6 // starting zoom
});

// setup data source
// https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson
// https://docs.mapbox.com/mapbox-gl-js/api/?size=n_10_n#map#addsource
map.on('load', function(){
    // map.addSource('census-tracts', {
    //     "type": "geojson",
    //     "data": "data/cancer_tracts/cancer_tracts.geojson"
    // });
    map.addSource('well-points', {
        "type": "geojson",
        "data": "data/well_nitrate/well_nitrate.geojson"
    });

    // add layers to the map
    // https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/
    // map.addLayer({
    //     "id": "census-tracts",
    //     "source": "census-tracts",
    //     "type": "line"
    // });
    map.addLayer({
        "id": "well-points",
        "source": "well-points",
        "type": "circle"
    });

    map.on('click', function(){
        // turn the current layers off
        // https://docs.mapbox.com/mapbox-gl-js/example/toggle-layers/
        map.setLayoutProperty('well-points', 'visibility', 'none')
        // map.setLayoutProperty('census-tracts', 'visibility', 'none')

        $.getJSON("data/well_nitrate/well_nitrate.geojson", function(wellPoints){
            // interpolate the wells grid
            // https://turfjs.org/docs/#interpolate
            var distance = 10;
            var weight = 2;
            var idwOptions = {gridType: "hex", property: "nitr_con", units: "kilometers", weight: weight};
            var wellGrid = turf.interpolate(wellPoints, distance, idwOptions);

            // add nitrate grid to map
            // map.addLayer({
            //     "id": "wells-grid",
            //     "source": {
            //         "type": "geojson",
            //         "data": wellGrid
            //     },
            //     "type": "fill",
            //     "paint": {
            //         "fill-color": [ "interpolate",
            //             ["linear"],
            //             ["get", "nitr_con"],
            //                 0, "#000000",
            //                 4, "#a1307e",
            //                 12, "yellow"
            //     ],
            //     "fill-outline-color": "#ffffff",
            //     "fill-opacity": 0.90
            //     }
            // });
        });

        // interpolate the census tracts cancer rates data to a grid
        $.getJSON("data/cancer_tracts/cancer_tract_centroids.geojson", function(tractPolygons){
            // interpolate the tracts
            // https://turfjs.org/docs/#interpolate
            var distance = 10;
            var weight = 2.0;
            var idwOptions = {gridType: "square", property: "canrate", units: "kilometers", weight: weight};
            var tractGrid = turf.interpolate(tractPolygons, distance, idwOptions);

            map.addLayer({
                "id": "tracts-grid",
                "source": {
                    "type": "geojson",
                    "data": tractGrid
                },
                "type": "fill",
                "paint": {
                    "fill-color": [ "interpolate",
                        ["linear"],
                        ["get", "canrate"],
                            0.0, "#440154",
                            0.1, "#20928c",
                            0.3, "yellow"
                ],
                "fill-outline-color": "#ffffff",
                "fill-opacity": 0.90
                }
            });
        });
    });
});
