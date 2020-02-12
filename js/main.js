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
    map.addSource('census-tracts', {
        "type": "geojson",
        "data": "data/cancer_tracts/cancer_tracts.geojson"
    });
    map.addSource('well-points', {
        "type": "geojson",
        "data": "data/well_nitrate/well_nitrate.geojson"
    });

    // add layers to the map
    // https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/
    map.addLayer({
        "id": "census-tracts",
        "source": "census-tracts",
        "type": "fill",
        "paint": {
            "fill-color": [ "interpolate",
                ["linear"],
                ["get", "canrate"],
                    0.0, "blue",
                    0.25, "yellow",
                    0.5, "red"
            ],
            "fill-opacity": 0.80
        }
    });
    map.addLayer({
        "id": "well-points",
        "source": "well-points",
        "type": "circle"
    });

    $('#weight-submit').on('click', function(){
        var weightValue = document.getElementById("weight-input").value;
        console.log("Weight: " + weightValue);
        // turn the current layers off
        // https://docs.mapbox.com/mapbox-gl-js/example/toggle-layers/
        map.setLayoutProperty('well-points', 'visibility', 'none')
        // map.setLayoutProperty('census-tracts', 'visibility', 'none')

        $.getJSON("data/well_nitrate/well_nitrate.geojson", function(wellPoints){
            // interpolate the wells grid
            // https://turfjs.org/docs/#interpolate
            var distance = 10;
            var weight = parseFloat(weightValue);
            var idwOptions = {gridType: "hex", property: "nitr_con", units: "kilometers", weight: weight};
            var nitrateGrid = turf.interpolate(wellPoints, distance, idwOptions);

            // // add nitrate grid to map
            map.addLayer({
                "id": "nitrate-grid",
                "source": {
                    "type": "geojson",
                    "data": nitrateGrid
                },
                "type": "fill",
                "paint": {
                    "fill-color": [ "interpolate",
                        ["linear"],
                        ["get", "nitr_con"],
                            0, "#000000",
                            4, "#a1307e",
                            12, "yellow"
                ],
                "fill-opacity": 0.90
                }
            });

            // interpolate the census tracts cancer rates data to a grid
            $.getJSON("data/cancer_tracts/cancer_tract_centroids.geojson", function(tractPolygons){
                $.getJSON("data/cancer_tracts/state.geojson", function(statePolygon){

                // interpolate the tracts
                // https://turfjs.org/docs/#interpolate
                var distance = 7;
                var weight = 4.0;
                var idwOptions = {gridType: "points", property: "canrate", units: "kilometers", weight: weight};
                var tractGrid = turf.interpolate(tractPolygons, distance, idwOptions);

                // map.setLayoutProperty('nitrate-grid', 'visibility', 'none')
                // map.addLayer({
                //     "id": "tracts-grid",
                //     "source": {
                //         "type": "geojson",
                //         "data": tractGrid
                //     },
                //     "type": "fill",
                //     "paint": {
                //         "fill-color": [ "interpolate",
                //             ["linear"],
                //             ["get", "canrate"],
                //                 0.0, "#440154",
                //                 0.25, "#20928c",
                //                 0.5, "yellow"
                //     ],
                //     "fill-opacity": 0.90
                //     }
                // });

                // regression time
                // build the array of nitrate values and cancer rates
                var valuesArray = [];
                for (var i in nitrateGrid.features){
                    for (var j in statePolygon.features){
                        var nitrateValue = Math.round(nitrateGrid.features[i].properties.nitr_con *1000)/1000;
                        var nitratePoint = turf.centerOfMass(nitrateGrid.features[i]);
                        // check if nitrate grid point is within state
                        if (turf.booleanPointInPolygon(nitratePoint, statePolygon.features[j])) {
                            var canrateValue = Math.round(turf.nearestPoint(nitratePoint, tractGrid).properties.canrate *1000000)/1000000;
                            nitrateGrid.features[i].properties.obs_canrate = canrateValue;
                            valuesArray.push([nitrateValue, canrateValue]);
                        };
                    };
                    // valuesArray.push([nitrateValue, canrateValue]);
                };

                // carry out the linear regression
                var linearRegression = ss.linearRegression(valuesArray);
                var regressionLine = ss.linearRegressionLine(linearRegression);
                console.log(linearRegression);

                // create the regression layer
                var regressionGrid = nitrateGrid;
                for (var i  in regressionGrid.features){
                    var gridPoint = turf.centerOfMass(regressionGrid.features[i]);
                    for (var j in statePolygon.features){
                        if (turf.booleanPointInPolygon(gridPoint, statePolygon.features[j])) {
                            // check if within state
                            var nitrateValue = regressionGrid.features[i].properties.nitr_con;
                            var calculatedCanrate = Math.round(((linearRegression.m * nitrateValue) + linearRegression.b)*100000)/100000;
                            regressionGrid.features[i].properties.calc_canrate = calculatedCanrate;
                            regressionGrid.features[i].properties.residual = regressionGrid.features[i].properties.obs_canrate - calculatedCanrate;
                        } else {
                            regressionGrid.features[i].properties.calc_canrate = 0.0;
                        };
                    };
                };

                // display the regression results
                map.setLayoutProperty('nitrate-grid', 'visibility', 'none');
                map.addLayer({
                    "id": "regression-grid",
                    "source": {
                        "type": "geojson",
                        "data": regressionGrid
                    },
                    "type": "fill",
                    "paint": {
                        "fill-color": [ "interpolate",
                            ["linear"],
                            ["get", "calc_canrate"],
                                0.00, "blue",
                                0.15, "yellow",
                                0.30, "red"
                    ],
                    "fill-opacity": 0.90
                    }
                });

                // display the residual
                map.setLayoutProperty('regression-grid', 'visibility', 'none');
                map.addLayer({
                    "id": "residual-grid",
                    "source": {
                        "type": "geojson",
                        "data": regressionGrid
                    },
                    "type": "fill",
                    "paint": {
                        "fill-color": [ "interpolate",
                            ["linear"],
                            ["get", "residual"],
                                0, "#000000",
                                0.0001, "blue",
                                0.15, "yellow",
                                0.3, "red"
                    ],
                    "fill-opacity": 0.90
                    }
                });

                // create the rsquared layer
                var rsqauredArray = ss.rSquared(valuesArray, regressionLine);
                console.log("R-Squared value: " + rsqauredArray);

                // layer toggle
                var toggleableLayerIds = [
                    'census-tracts',
                    'well-points',
                    'nitrate-grid',
                    'regression-grid',
                    'residual-grid'
                ];

                for (var i = 0; i < toggleableLayerIds.length; i++) {
                    var id = toggleableLayerIds[i];

                    var link = document.createElement('a');
                    link.href = '#';
                    link.className = 'active';
                    link.textContent = id;

                    link.onclick = function(e) {
                        var clickedLayer = this.textContent;
                        e.preventDefault();
                        e.stopPropagation();

                        var visibility = map.getLayoutProperty(clickedLayer, 'visibility');
                        if (visibility === 'visible') {
                            map.setLayoutProperty(clickedLayer, 'visibility', 'none');
                            this.className = '';
                        } else {
                            this.className = 'active';
                            map.setLayoutProperty(clickedLayer, 'visibility', 'visible');
                            }
                    };

                    var layers = document.getElementById('menu');
                    layers.appendChild(link);
                };
            });
        });
        });


    });
});
