// src/main.js — MapLibre + live points via same-origin API
import "./style.css";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";

// Map style (replace key if needed)
const STYLE_URL = "https://api.maptiler.com/maps/streets/style.json?key=Tp6EzxIVbiDmr80nzdV0";

// Refresh cadence (ms)
const REFRESH_MS = 10000;     // 10s
const LAST_ONLY  = true;      // keep only the newest marker

// Same-origin API (one-service): just call "/api/..."
const API = "";

// Create map
const map = new maplibregl.Map({
  container: "map",
  style: STYLE_URL,
  center: [-117.67, 33.65],   // default center
  zoom: 11
});

let markers = []; // track current markers

function clearMarkers() {
  for (const m of markers) m.remove();
  markers = [];
}

function renderMarkers(rows) {
  if (!Array.isArray(rows)) return;
  if (LAST_ONLY && rows.length > 0) rows = [rows[0]]; // newest first from API

  clearMarkers();
  for (const r of rows) {
    if (r.lon == null || r.lat == null) continue;
    const el = document.createElement("div");
    el.style.width = "12px";
    el.style.height = "12px";
    el.style.borderRadius = "50%";
    el.style.background = "red";
    const mk = new maplibregl.Marker({ element: el }).setLngLat([r.lon, r.lat]).addTo(map);
    markers.push(mk);
  }
  if (rows.length > 0) {
    map.easeTo({ center: [rows[0].lon, rows[0].lat], duration: 500 });
  }
}

async function loadAndRender() {
  try {
    const r = await fetch(`${API}/api/points?limit=100`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const rows = await r.json(); // [{id, ts, value, voltage, lat, lon}, ...]
    renderMarkers(rows);
  } catch (err) {
    console.error("Error loading points:", err);
  }
}

map.on("load", () => {
  loadAndRender();
  setInterval(loadAndRender, REFRESH_MS);
});
