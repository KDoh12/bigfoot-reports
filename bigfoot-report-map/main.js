import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import maplibregl from "maplibre-gl";
import key from "./scripts/key.js";
import { point } from "@turf/helpers";
import turfBuffer from "@turf/buffer";
import turfArea from "@turf/area";

// Global Variables
let d = {
  locate: {},
  remote: {},
  bufferFt: 132000, // 25 miles in feet
};
let pt, buffer;

// Build UI content
const content = document.querySelector("#content");
const openButton = document.querySelector("#openButton");
const offCanvas = document.querySelector("#offCanvas");
const overlay = document.querySelector("#overlay");
const closeButton = document.querySelector("#closeButton");

const openUI = () => {
  offCanvas.classList.remove("-z-10");
  overlay.classList.remove("opacity-0");
  offCanvas.classList.add("z-30");
  overlay.classList.add("opacity-100", "pointer-events-auto");
};

const closeUI = () => {
  offCanvas.classList.remove("z-30");
  overlay.classList.remove("opacity-100", "pointer-events-auto");
  offCanvas.classList.add("-z-10");
  overlay.classList.add("opacity-0", "pointer-events-none");
};

openButton.addEventListener("click", openUI);
overlay.addEventListener("click", closeUI);
closeButton.addEventListener("click", closeUI);

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

// Add geolocate control
const geolocate = new maplibregl.GeolocateControl({
  positionOptions: {
    enableHighAccuracy: true,
  },
  fitBoundsOptions: {
    maxZoom: 8,
  },
});

// Add controls to map
map.addControl(nav);
map.addControl(scale);
map.addControl(geolocate);

// Create a popup element
const popup = new maplibregl.Popup({
  closeButton: false,
  closeOnClick: false,
});
popup.addClassName("font-sans rounded-lg shadow-lg bg-white p-2 h-max");

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

// When geolocate is activated
geolocate.on("geolocate", function (e) {
  d.locate.lng = e.coords.longitude;
  d.locate.lat = e.coords.latitude;
  // console.log(d.locate);

  getData(e); // Get data
});

// When map is clicked
map.on("click", function (e) {
  // Get lat and long
  d.locate.lng = e.lngLat.lng;
  d.locate.lat = e.lngLat.lat;
  // console.log(d.locate);

  getData(e); // Get data
});

// ********** Functions **********

// Build query and get data
function getData(e) {
  // Build API query
  const query = `https://services.arcgis.com/ue9rwulIoeLEI9bj/arcgis/rest/services/BigFoot_Sightings/FeatureServer/0/query?outFields=Name,Descr,TimeWhen,Class&where=1%3D1&geometry=%7B%22x%22+%3A+${d.locate.lng}%2C+%22y%22+%3A+${d.locate.lat}%2C+%22spatialReference%22+%3A+%7B%22wkid%22+%3A+4326%7D%7D&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&distance=${d.bufferFt}&units=esriSRUnit_Foot&outFields=*&outSR=4326&f=geojson`;

  // console.log(query);

  // Grab Bigfoot reports and return a GeoJSON
  fetch(query)
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      d.remote = data;
      processLayer();
    });
}

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

  // If zoomed out
  if (map.getZoom() < 8) {
    // Zoom to buffer area
    map.flyTo({
      center: [d.locate.lng, d.locate.lat],
      zoom: 8,
    });
  }

  // calculate buffer area
  let bufferArea = calcArea(buffer);

  // Find the number of features returned minus 1 to be used in popup
  let featuresLength = Object.keys(d.remote.features).length - 1;

  // Add popups to layer
  map.on("mouseenter", "bigfoot", (e) => {
    map.getCanvas().style.cursor = "pointer";
    const coords = e.features[0].geometry.coordinates.slice();
    let description = e.features[0].properties.Descr.split("</b>");
    let content = `${description[0]}</b>`;
    content += `<hr> There are ${featuresLength} other sightings reported in the observed ${Math.round(bufferArea).toLocaleString()} sq mi`;

    // Add popup to map
    popup.setLngLat(coords).setHTML(content).addTo(map);
  });

  // Close popups when no longer hovering
  map.on("mouseleave", "bigfoot", () => {
    map.getCanvas().style.cursor = "";
    popup.remove();
  });
}

// Calculate the area of the buffer
function calcArea(buffer) {
  let area = turfArea(buffer) / 2590000; // Convert square meters to squre miles
  return area;
}
