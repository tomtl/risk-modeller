mapboxgl.accessToken = 'pk.eyJ1IjoidHRsZWU0IiwiYSI6ImNrNjBwd3pmaTBhbmwzZ2w2bDdyeDcyYW0ifQ.1cscNlBBjYXqedUM8c4ELw';

var map = new mapboxgl.Map({
    container: 'map', // container id
    // style: 'mapbox://styles/mapbox/streets-v11', // stylesheet location
    style: 'mapbox://styles/mapbox/dark-v10',
    center: [-90.0, 44.8], // starting position [lng, lat],
    zoom: 6, // starting zoom
    preserveDrawingBuffer: true
});

var regressionGrid = [];

// hide the unused legends
$('#nitrate-grid-legend').hide();
$('#regression-grid-legend').hide();
$('#residual-grid-legend').hide();
$('#explanation-text').hide()

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
                    0.0, "#2974ff",
                    0.25, "yellow",
                    0.5, "red"
            ],
            "fill-opacity": 0.65
        }
    });
    map.addLayer({
        "id": "well-points",
        "source": "well-points",
        "type": "circle",
        'paint': {
            // make circles larger as the user zooms from z6 to z12
            'circle-radius': {
                'base': 1.0,
                'stops': [[6, 2], [12, 5]]
            },
            // color circles by ethnicity, using a match expression
            // https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-match
            'circle-color': [ "interpolate",
                ["linear"],
                ["get", "nitr_con"],
                0, "#fff2f5",
                4, "#ff63b6",
                12, "#8b008b"
            ]
        },
    });

    $('#weight-submit').on('click', function(){
        var weightValue = document.getElementById("weight-input").value;
        console.log("Input Weight: " + weightValue);

        // validate user entry
        if (isNaN(weightValue)) {
            var message = "k value must be a number >= 1. Setting k to 2.";
            document.getElementById('idw-weight').innerHTML = '<p>' + message + '</p>';
            console.log(message);
            weightValue = 2;
        };

        if (weightValue < 1){
            var message = "k value must be 1 or greater. Setting k to 2.";
            document.getElementById('idw-weight').innerHTML = '<p>' + message + '</p>';
            console.log(message);
            weightValue = 2;
        }

        console.log("IDW weight: " + weightValue);
        document.getElementById('idw-weight').innerHTML = '<p><strong>k value: </strong>' + weightValue + '</p>';

        // turn the current layers off
        // https://docs.mapbox.com/mapbox-gl-js/example/toggle-layers/
        map.setLayoutProperty('well-points', 'visibility', 'none')
        map.setLayoutProperty('census-tracts', 'visibility', 'none')
        $('#well-points-legend').hide();
        $('#census-tracts-legend').hide();

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
                            0, "#fff2f5",
                            4, "#ff63b6",
                            12, "#8b008b"
                ],
                "fill-opacity": 0.65
                }
            });
            $('#nitrate-grid-legend').show();

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
                regressionGrid = nitrateGrid;
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
                $('#nitrate-grid-legend').hide();
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
                                0.00, "#2974ff",
                                0.15, "yellow",
                                0.30, "red"
                    ],
                    "fill-opacity": 0.65
                    }
                });
                $('#regression-grid-legend').show();

                // add the residual layer but dont display it
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
                                // 0, "#000000",
                                0, "blue",
                                0.15, "yellow",
                                0.3, "red"
                    ],
                    "fill-opacity": 0.65
                    }
                });
                map.setLayoutProperty('residual-grid', 'visibility', 'none');
                $('#residual-grid-legend').hide();

                // create the rsquared layer
                var rsqauredArray = ss.rSquared(valuesArray, regressionLine);
                console.log("R-Squared value: " + rsqauredArray);
                document.getElementById('stats').innerHTML = '<p><strong>R-squared: </strong>' + rsqauredArray + '</p>';

                // POPUPS
                map.on('click', 'regression-grid', function(e){
                    var coordinates = e.lngLat;
                    var description = e.features[0].properties.calc_canrate;

                    // Ensure that if the map is zoomed out such that multiple
                    // copies of the feature are visible, the popup appears
                    // over the copy being pointed to.
                    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
                    }

                    new mapboxgl.Popup()
                        .setLngLat(coordinates)
                        .setHTML(description)
                        .addTo(map);
                });

                // Change the cursor to a pointer when the mouse is over the places layer.
                map.on('mouseenter', 'regression-grid', function() {
                    map.getCanvas().style.cursor = 'pointer';
                });

                // Change it back to a pointer when it leaves.
                map.on('mouseleave', 'regression-grid', function() {
                    map.getCanvas().style.cursor = '';
                });

                // setup the chart
                createChart(regressionGrid);

                // remove the intro and IDW weight div
                $('#intro').hide();
                $('#weight-input-div').hide();
                // display the results explanation text
                $('#explanation-text').show()

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
                    // link.className = 'inactive';
                    if (id == 'regression-grid') {
                        link.className = 'active';
                    } else {
                        link.className = 'inactive';
                    };

                    // Layer labels
                    var layerLabels = {
                        'census-tracts': 'Observed cancer rates',
                        'well-points': 'Well nitrate concentrations',
                        'nitrate-grid': 'Interpolated nitrate values',
                        'regression-grid': 'Regression results',
                        'residual-grid': 'Regression residuals'
                    };
                    link.textContent = layerLabels[id];

                    link.onclick = function(e) {
                        var clickedText = this.textContent;
                        var clickedLayer = '';

                        for (var j in layerLabels) {
                            // Get the layer name using the label
                            if (clickedText === layerLabels[j]) {
                                clickedLayer = j;
                            };
                        };

                        e.preventDefault();
                        e.stopPropagation();

                        var visibility = map.getLayoutProperty(clickedLayer, 'visibility');
                        if (visibility === 'visible') {
                            map.setLayoutProperty(clickedLayer, 'visibility', 'none');
                            $('#' + clickedLayer + '-legend').hide();
                            this.className = '';
                        } else {
                            this.className = 'active';
                            map.setLayoutProperty(clickedLayer, 'visibility', 'visible');
                            $('#' + clickedLayer + '-legend').show();
                            }
                    };

                    var layers = document.getElementById('menu');
                    layers.appendChild(link);
                };

            });
        });
        });

        // // Export the screen as an image
        // $("#export").on('click', function() {
        //     // var canvas = document.getElementById("map");
        //     var image = map.getCanvas().toDataURL("image/png") //.replace("image/png", "image/octet-stream"); //Convert image to 'octet-stream' (Just a download, really)
        //     console.log(image);
        //
        //     var newData = image.replace(
        //         // /^data:image\/png/, "data:application/octet-stream");
        //         "image/png", "image/octet-stream");
        //
        //         $("#export").attr(
        //         "download", "output.png").attr(
        //         "href", newData);
        // });
    });
});

function createChart(data){
    chart = document.getElementById('chart');

    // set up the data for the chart
    var nitrList = [];
    var obsCanrateList = [];
    var calcCanrateList = []
    for (var i in data.features){
        var obs_canrate = data.features[i].properties.obs_canrate;
        var calc_canrate = data.features[i].properties.calc_canrate
        var nitr_con = data.features[i].properties.nitr_con;

        if (calc_canrate > 0) {
            nitrList.push(nitr_con);
            obsCanrateList.push(obs_canrate);
            calcCanrateList.push(calc_canrate);
        };
    };

    // observed canrate points
    var trace1 = {
        x: nitrList,
        y: obsCanrateList,
        mode: 'markers',
        type: 'scatter',
        name: 'Actual cancer rates'
    };

    // calculated canrate points
    var trace2 = {
      x: nitrList,
      y: calcCanrateList,
      mode: 'markers',
      type: 'scatter',
      name: 'Calculated cancer rates'
    };

    var layout = {
      title: {
        text:'Scatterplot',
      },
      xaxis: {
        title: {
          text: 'Nitrate concentration',
        },
      },
      yaxis: {
        title: {
          text: 'Cancer rate',
        }
      },
      margin: {
          l: 40,
          r: 40,
          b: 40,
          t: 40
      }
    };

    // render the chart
    var chartData = [trace1, trace2];
    Plotly.newPlot('chart', chartData, layout, {displayModeBar: false});
};
