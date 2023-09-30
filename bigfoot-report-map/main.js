import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import maplibregl from "maplibre-gl";
import key from "./scripts/key.js";
import { point } from "@turf/helpers";
import turfBuffer from "@turf/buffer";

// Global Variables
let d = {
  i: 0,
  locate: {},
  remote: {},
  bufferFt: 132000,
};
let pt, buffer;

// Build map
const map = new maplibregl.Map({
  container: "map",
  style: `https://api.maptiler.com/maps/bright-v2/style.json?key=${key}`,
  center: [-98, 40],
  zoom: 4,
});

// Add a navigation control
const nav = new maplibregl.NavigationControl();

// Add a scale control
const scale = new maplibregl.ScaleControl({
  maxWidth: 200,
  unit: "imperial",
});

// Add controls to map
map.addControl(nav);
map.addControl(scale);

// When map loads...
map.on("load", function () {
  // Add State source and layer
  map.addSource("states", {
    type: "geojson",
    data: "data/us-states-optimized.json",
  });
  map.addLayer({
    id: "states",
    type: "line",
    source: "states",
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
    paint: {
      "line-color": "#000",
      "line-width": 1,
    },
  });
  map.loadImage("icons/caution.png", (error, image) => {
    if (error) throw error;
    map.addImage("caution-marker", image);
  });
});

// When map is clicked
map.on("click", function (e) {
  // Get lat and long
  d.locate.lng = e.lngLat.lng;
  d.locate.lat = e.lngLat.lat;

  console.log(d.locate);

  // Build API query
  const query = `https://services.arcgis.com/ue9rwulIoeLEI9bj/arcgis/rest/services/BigFoot_Sightings/FeatureServer/0/query?outFields=Name,Descr,TimeWhen,Class&where=1%3D1&geometry=%7B%22x%22+%3A+${d.locate.lng}%2C+%22y%22+%3A+${d.locate.lat}%2C+%22spatialReference%22+%3A+%7B%22wkid%22+%3A+4326%7D%7D&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&distance=${d.bufferFt}&units=esriSRUnit_Foot&outFields=*&outSR=4326&f=geojson`;

  console.log(query);

  // Grab Bigfoot reports and return a GeoJSON
  fetch(query)
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      d.remote = data;
      processLayer();
    });
});

// Create buffer and draw layer on map
function processLayer() {
  // Check if an existing buffer and points exist
  if (pt || buffer) {
    // If they do, remove them first
    map.removeLayer("buffer");
    map.removeLayer("bigfoot");
    map.removeSource("buffer");
    map.removeSource("bigfoot");
  }
  // Create a point and buffer using turf
  pt = point([d.locate.lng, d.locate.lat]);
  buffer = turfBuffer(pt, d.bufferFt, { units: "feet" });

  // Add Buffer and Bigfoot Reports
  map.addSource("buffer", {
    type: "geojson",
    data: buffer,
  });
  map.addSource("bigfoot", {
    type: "geojson",
    data: d.remote,
  });
  map.addLayer({
    id: "buffer",
    type: "fill",
    source: "buffer",
    paint: {
      "fill-color": "#18BBF2",
      "fill-opacity": 0.1,
      "fill-outline-color": "#000",
    },
  });
  map.addLayer({
    id: "bigfoot",
    type: "symbol",
    source: "bigfoot",
    layout: {
      "icon-image": "caution-marker",
    },
  });
}
