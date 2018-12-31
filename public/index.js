function processForm() {
    geocode(platform, document.getElementById("start").value, document.getElementById("end").value);
}

function geocode(platform, from, to) {
    let geocoder = platform.getGeocodingService();
    let geocodingParameters = {
        searchText: from,
        jsonattributes : 1
    };

    geocoder.geocode(
        geocodingParameters,
        function(fromResult) {
            geocoder = platform.getGeocodingService();
            geocodingParameters = {
                searchText: to,
                jsonattributes : 1
            };
            geocoder.geocode(
                geocodingParameters,
                function(toResult) {
                    fromCoords = getCoords(fromResult);
                    toCoords = getCoords(toResult);
                    calculateRouteFromAtoB(platform, [], {latFrom: fromCoords.lat, lonFrom: fromCoords.long, latTo: toCoords.lat, lonTo: toCoords.long})
                },
                console.error
            )
        },
        console.error
    );
}

function getCoords(result) {
    let locations = result.response.view[0].result;
    let lat = locations[0].location.displayPosition.latitude;
    let long = locations[0].location.displayPosition.longitude;
    return {lat:lat, long:long};
}

function calculateRouteFromAtoB (platform, avoid, toFrom) {
    let avoidString = "";
    avoid.forEach(function(element) {
        avoidString += (element.latMax.toString() + ",");
        avoidString += (element.lonMin.toString() + ";");
        avoidString += (element.latMin.toString() + ",");
        avoidString += (element.lonMax.toString() + "!");
    });
    if(avoidString.length) {
        avoidString = avoidString.substring(0, avoidString.length - 1);
    }
    let router = platform.getRoutingService(),
        routeRequestParams = {
            mode: 'fastest;car',
            representation: 'display',
            routeattributes : 'waypoints,summary,shape,legs',
            maneuverattributes: 'direction,action',
            waypoint0: `${toFrom.latFrom},${toFrom.lonFrom}`,
            waypoint1: `${toFrom.latTo},${toFrom.lonTo}`,
            avoidareas: avoidString
        };

    router.calculateRoute(
        routeRequestParams,
        function(result) {
            getCrimePoints(platform, result, toFrom);
        },
        console.error
    );
}

function getCrimePoints (platform, result, toFrom) {
    let route = result.response.route[0];
    let points = [];
    route.shape.forEach(function(point) {
        let parts = point.split(',');
        points.push({latitude: parts[0], longitude: parts[1]});
    });

    let send = {coords: points};
    $.ajax({
        url: 'http://127.0.0.1:5000/api/nearbyCrimes',
        type: 'post',
        data: send,
        success: function(res) {
            console.log(res);
            onSucc(platform, result, res, toFrom)
        },
        error: function(err) {
            console.error(err);
            return [];
        }
    });
}

function onSucc (platform, result, crimes, toFrom) {
    let route = result.response.route[0].shape;
    let avoid = [];
    for(let i = 0; i < crimes.crimes.length; i++) {
        if(crimes.crimes[i] >= 1100) {
            let parts = route[i].split(',');
            let lat = parseFloat(parts[0]);
            let lon = parseFloat(parts[1]);
            // Create a 1km box around our latitude/longitude (0.5km radius)
            // 0.008983 = 1km latitude
            // 0.015060 = 1km longitude
            let latMin = lat - 0.0044915;
            let latMax = lat + 0.0044915;
            let lonMin = lon - 0.00753;
            let lonMax = lon + 0.00753;

            avoid.push({latMin:latMin, latMax:latMax, lonMin:lonMin, lonMax:lonMax});
        }
    }

    if(avoid.length > 0) {
        console.log(`Found ${avoid.length} crime areas...recalculating...`);
        calculateRouteFromAtoB(platform, avoid, toFrom);
    } else {
        console.log(`Found 0 crime areas...displaying...`);
        onSuccess(result);
    }
}

/**
 * This function will be called once the Routing REST API provides a response
 * @param  {Object} result          A JSONP object representing the calculated route
 *
 * see: http://developer.here.com/rest-apis/documentation/routing/topics/resource-type-calculate-route.html
 */
function onSuccess(result) {
    let route = result.response.route[0];
    /*
     * The styling of the route response on the map is entirely under the developer's control.
     * A representitive styling can be found the full JS + HTML code of this example
     * in the functions below:
     */
    addRouteShapeToMap(route);
    addManueversToMap(route);

    addWaypointsToPanel(route.waypoint);
    addManueversToPanel(route);
    addSummaryToPanel(route.summary);
    // ... etc.
}

/**
 * Boilerplate map initialization code starts below:
 */

    // set up containers for the map  + panel
let mapContainer = document.getElementById('map'),
    routeInstructionsContainer = document.getElementById('panel');

//Step 1: initialize communication with the platform
let platform = new H.service.Platform({
    app_id: 'QQ4Zwdq31YEdqdPSGAO2',
    app_code: 'Rcj9b100CYQfyhl5xDh3Tg',
    useHTTPS: true
});
let pixelRatio = window.devicePixelRatio || 1;
let defaultLayers = platform.createDefaultLayers({
    tileSize: pixelRatio === 1 ? 256 : 512,
    ppi: pixelRatio === 1 ? undefined : 320
});

//Step 2: initialize a map - this map is centered over Chicago
let map = new H.Map(mapContainer,
    defaultLayers.normal.map,{
        center: {lat:41.8781, lng:-87.6298},
        zoom: 13,
        pixelRatio: pixelRatio
    });

//Step 3: make the map interactive
// MapEvents enables the event system
// Behavior implements default interactions for pan/zoom (also on mobile touch environments)
let behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));

// Create the default UI components
let ui = H.ui.UI.createDefault(map, defaultLayers);

// Hold a reference to any infobubble opened
let bubble;

/**
 * Opens/Closes a infobubble
 * @param  {H.geo.Point} position     The location on the map.
 * @param  {String} text              The contents of the infobubble.
 */
function openBubble(position, text){
    if(!bubble){
        bubble =  new H.ui.InfoBubble(
            position,
            // The FO property holds the province name.
            {content: text});
        ui.addBubble(bubble);
    } else {
        bubble.setPosition(position);
        bubble.setContent(text);
        bubble.open();
    }
}


/**
 * Creates a H.map.Polyline from the shape of the route and adds it to the map.
 * @param {Object} route A route as received from the H.service.RoutingService
 */
function addRouteShapeToMap(route){
    let lineString = new H.geo.LineString(),
        routeShape = route.shape,
        polyline;

    routeShape.forEach(function(point) {
        var parts = point.split(',');
        lineString.pushLatLngAlt(parts[0], parts[1]);
    });

    polyline = new H.map.Polyline(lineString, {
        style: {
            lineWidth: 4,
            strokeColor: 'rgba(0, 128, 255, 0.7)'
        }
    });
    // Add the polyline to the map
    map.addObject(polyline);
    // And zoom to its bounding rectangle
    map.setViewBounds(polyline.getBounds(), true);
}


/**
 * Creates a series of H.map.Marker points from the route and adds them to the map.
 * @param {Object} route  A route as received from the H.service.RoutingService
 */
function addManueversToMap(route){
    let svgMarkup = '<svg width="18" height="18" ' +
        'xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="8" cy="8" r="8" ' +
        'fill="#1b468d" stroke="white" stroke-width="1"  />' +
        '</svg>',
        dotIcon = new H.map.Icon(svgMarkup, {anchor: {x:8, y:8}}),
        group = new  H.map.Group(),
        i,
        j;

    // Add a marker for each maneuver
    for (i = 0;  i < route.leg.length; i += 1) {
        for (j = 0;  j < route.leg[i].maneuver.length; j += 1) {
            // Get the next maneuver.
            maneuver = route.leg[i].maneuver[j];
            // Add a marker to the maneuvers group
            var marker =  new H.map.Marker({
                    lat: maneuver.position.latitude,
                    lng: maneuver.position.longitude} ,
                {icon: dotIcon});
            marker.instruction = maneuver.instruction;
            group.addObject(marker);
        }
    }

    group.addEventListener('tap', function (evt) {
        map.setCenter(evt.target.getPosition());
        openBubble(
            evt.target.getPosition(), evt.target.instruction);
    }, false);

    // Add the maneuvers group to the map
    map.addObject(group);
}


/**
 * Creates a series of H.map.Marker points from the route and adds them to the map.
 * @param {Object} route  A route as received from the H.service.RoutingService
 */
function addWaypointsToPanel(waypoints){
    let nodeH3 = document.createElement('h3'),
        waypointLabels = [],
        i;

    for (i = 0;  i < waypoints.length; i += 1) {
        waypointLabels.push(waypoints[i].label)
    }

    nodeH3.textContent = waypointLabels.join(' - ');

    routeInstructionsContainer.innerHTML = '';
    routeInstructionsContainer.appendChild(nodeH3);
}

/**
 * Creates a series of H.map.Marker points from the route and adds them to the map.
 * @param {Object} route  A route as received from the H.service.RoutingService
 */
function addSummaryToPanel(summary){
    let summaryDiv = document.createElement('div'),
        content = '';
    content += '<b>Total distance</b>: ' + summary.distance  + 'm. <br/>';
    content += '<b>Travel Time</b>: ' + summary.travelTime.toMMSS() + ' (in current traffic)';

    summaryDiv.style.fontSize = 'small';
    summaryDiv.style.marginLeft ='5%';
    summaryDiv.style.marginRight ='5%';
    summaryDiv.innerHTML = content;
    routeInstructionsContainer.appendChild(summaryDiv);
}

/**
 * Creates a series of H.map.Marker points from the route and adds them to the map.
 * @param {Object} route  A route as received from the H.service.RoutingService
 */
function addManueversToPanel(route){
    let nodeOL = document.createElement('ol'),
        i,
        j;

    nodeOL.style.fontSize = 'small';
    nodeOL.style.marginLeft ='5%';
    nodeOL.style.marginRight ='5%';
    nodeOL.className = 'directions';

    // Add a marker for each maneuver
    for (i = 0;  i < route.leg.length; i += 1) {
        for (j = 0;  j < route.leg[i].maneuver.length; j += 1) {
            // Get the next maneuver.
            maneuver = route.leg[i].maneuver[j];

            var li = document.createElement('li'),
                spanArrow = document.createElement('span'),
                spanInstruction = document.createElement('span');

            spanArrow.className = 'arrow '  + maneuver.action;
            spanInstruction.innerHTML = maneuver.instruction;
            li.appendChild(spanArrow);
            li.appendChild(spanInstruction);

            nodeOL.appendChild(li);
        }
    }

    routeInstructionsContainer.appendChild(nodeOL);
}


Number.prototype.toMMSS = function () {
    return  Math.floor(this / 60)  +' minutes '+ (this % 60)  + ' seconds.';
};
