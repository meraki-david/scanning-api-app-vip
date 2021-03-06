(function ($) {
  var map,                                      // This is the Google map
    clientMarker,                               // The current marker when we are following a single client
    clientUncertaintyCircle,                    // The circle describing that client's location uncertainty
    lastEvent,                                  // The last scheduled polling task
    lastInfoWindowMac,                          // The last Mac displayed in a marker tooltip
    allMarkers = [],                            // The markers when we are in "View All" mode
    lastMac = "",                               // The last requested MAC to follow
    infoWindow = new google.maps.InfoWindow(),  // The marker tooltip
    lookupFrequency = 5000,                    // Frequency of the lookup (in milliseconds)
    markerImage = new google.maps.MarkerImage('pink_circle.png',
      new google.maps.Size(20, 20),
      new google.maps.Point(0, 0),
      new google.maps.Point(4.5, 4.5)
    ),
    markerImageGreen = new google.maps.MarkerImage('green_circle.png',
      new google.maps.Size(15, 15),
      new google.maps.Point(0, 0),
      new google.maps.Point(4.5, 4.5)
    ),
    markerImageTypes = {
      'DevicesSeen': markerImageGreen,
      'BluetoothDevicesSeen': markerImage
    },
    uncertaintyCircleColors = {
      'DevicesSeen': 'LightGreen',
      'BluetoothDevicesSeen': '#ff69b4'
    },
    vip_list = [
      "3c:2e:f9:72:b1:c9", // Laurel
      "dc:0c:5c:6d:13:86", // Pete's Iphone
      "34:f3:9a:2e:00:4a",  // Pete's Laptop
      "44:85:00:46:7a:bc", // test client
      "fc:db:b3:f1:6e:35", //test client,
      "88:71:e5:5e:5f:32",
      "e8:2a:ea:ba:45:c8",
      "80:00:0b:33:94:9c",
      "b8:8a:60:6e:03:07"

    ];
      

  // Removes all markers
  function clearAll() {
    clientMarker.setMap(null);
    clientUncertaintyCircle.setMap(null);
    lastInfoWindowMac = "";
    var m;
    while (allMarkers.length !== 0) {
      m = allMarkers.pop();
      if (infoWindow.anchor === m) {
        lastInfoWindowMac = m.mac;
      }
      m.setMap(null);
    }
  }

  function get_icon_for_client(client) {
    if (vip_list.indexOf(client.mac) !== -1) {
      return markerImageTypes['BluetoothDevicesSeen'];
    } else {
      return markerImageTypes[client.eventType];
    }
  }

  // Plots the location and uncertainty for a single MAC address
  function track(client) {
    clearAll();
    if (client !== null && client.lat !== null && !(typeof client.lat === 'undefined')) {
      var pos = new google.maps.LatLng(client.lat, client.lng);
      if (client.manufacturer != null) {
        mfrStr = client.manufacturer + " ";
      } else {
        mfrStr = "";
      }
      if (client.os != null) {
        osStr = " running " + client.os;
      } else {
        osStr = "";
      }
      if (client.ssid != null) {
        ssidStr = " with SSID '" + client.ssid + "'";
      } else {
        ssidStr = "";
      }
      if (client.floors != null && client.floors !== "") {
        floorStr = " at '" + client.floors + "'"
      } else {
        floorStr = "";
      }
      $('#last-mac').text(mfrStr + "'" + lastMac + "'" + osStr + ssidStr +
        " last seen on " + client.seenString + floorStr +
        " with uncertainty " + client.unc.toFixed(1) + " meters (reloading every 20 seconds)");
      map.setCenter(pos);
      clientMarker.setMap(map);
      clientMarker.setPosition(pos);
      // if it's a vip then branch for blue else >>
      if (vip_list.indexOf(client.mac) !== -1) {
        clientMarker.setIcon(get_icon_for_client(client));
      } else {
        clientMarker.setIcon(get_icon_for_client(client));
      }
      
      clientUncertaintyCircle = new google.maps.Circle({
        map: map,
        center: pos,
        radius: client.unc,
        fillColor: uncertaintyCircleColors[client.eventType],
        fillOpacity: 0.25,
        strokeColor: uncertaintyCircleColors[client.eventType],
        strokeWeight: 1
      });
    } else {
      $('#last-mac').text("Client '" + lastMac + "' could not be found");
    }
  }


  // Adds a marker for a single client within the "view all" perspective
  function addMarker(client) {
    var m = new google.maps.Marker({
      position: new google.maps.LatLng(client.lat, client.lng),
      map: map,
      mac: client.mac,
      icon: get_icon_for_client(client)
    });
    google.maps.event.addListener(m, 'click', function () {
      infoWindow.setContent("<div>" + client.mac + "</div> (<a class='client-filter' href='#' data-mac='" +
        client.mac + "'>Follow this client)</a>");
      infoWindow.open(map, m);
    });
    if (client.mac === lastInfoWindowMac) {
      infoWindow.open(map, m);
    }
    allMarkers.push(m);
  }

  // Displays markers for all clients
  function trackAll(clients) {
    clearAll();
    if (clients.length === 0) {
      $('#last-mac').text("Found no clients (if you just started the web server, you may need to wait a few minutes to receive pushes from Meraki)");
    } else { $('#last-mac').text("Found " + clients.length + " clients (reloading every " + lookupFrequency/1000 + " seconds)"); }
    clientUncertaintyCircle.setMap(null);
    clients.forEach(addMarker);
  }

  // Looks up a single MAC address
  function lookup(mac) {
    $.getJSON('/clients/' + mac, function (response) {
      track(response);
    });
  }

  // Looks up the list of floors
  function lookupFloorList() {
    $.getJSON('/floors', function(floorList){
      $.each(floorList, function(index, floor){
        if(floor === ""){
          floor = "None";
        }
        $("#floor-select").append($("<option></option>").val(floor).html(floor));
      });
    });
  }

  // Looks up all MAC addresses
  function lookupAll(query) {
    $('#last-mac').text("Looking up clients...");
    $.getJSON('/clients/', query, function (response) {
      trackAll(response);
    });
  }

  // Begins a task timer to reload a single MAC every 20 seconds
  function startLookup() {
    lastMac = $('#mac-field').val().trim();
    if (lastEvent !== null) { window.clearInterval(lastEvent); }
    lookup(lastMac);
    lastEvent = window.setInterval(lookup, lookupFrequency, lastMac);
  }
  
  // Begins a task timer to reload all MACs every 20 seconds
  function startLookupAll() {
    floors =  $('#floor-select').val().trim(),
    eventType = $('#event-select').val().trim()
    if(floors == "None"){
      floors = "";
    }
    query = {
      floors: floors,
      eventType: eventType
    }
    if (lastEvent !== null) { window.clearInterval(lastEvent); }
    lastEvent = window.setInterval(lookupAll, lookupFrequency, query);
    lookupAll(query);
  }

  // This is called after the DOM is loaded, so we can safely bind all the
  // listeners here.
  function initialize() {
    var center = new google.maps.LatLng(39.48911, -119.79319);
    var mapOptions = {
      zoom: 20,
      center: center
    };
    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
    clientMarker = new google.maps.Marker({
      position: center,
      map: null,
      icon: markerImage
    });
    clientUncertaintyCircle = new google.maps.Circle({
      position: center,
      map: null
    });

    $('#track').click(startLookup).bind("enterKey", startLookup);

    lookupFloorList();

    $("#event-select, #floor-select").change(startLookupAll);

    $(document).on("click", ".client-filter", function (e) {
      e.preventDefault();
      var mac = $(this).data('mac');
      $('#mac-field').val(mac);
      startLookup();
    });

    startLookupAll();
  }

  // Call the initialize function when the window loads
  $(window).load(initialize);
}(jQuery));
