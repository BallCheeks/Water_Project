// src/main.js — MapLibre + live points from your Node API
// - Updates in place (no duplicate markers)
// - Toggle LAST_ONLY to show only the newest reading

import maplibregl from 'maplibre-gl';

// ======== SETTINGS ========
const API_BASE   = import.meta?.env?.VITE_API_BASE || 'http://localhost:3000';
const STYLE_URL  = 'https://demotiles.maplibre.org/style.json'; // no token needed
const START_LNG  = -117.686;
const START_LAT  = 33.646;
const START_ZOOM = 12;
const REFRESH_MS = 10_000;   // match your Arduino 10s posts
const LAST_ONLY  = true;     // <-- set to false to show ALL points
// ==========================

const containerId = 'map';

// Ensure the container exists (in case your HTML didn’t include it)
let containerEl = document.getElementById(containerId);
if (!containerEl) {
  containerEl = document.createElement('div');
  containerEl.id = containerId;
  containerEl.style.height = '100vh';
  document.body.style.margin = '0';
  document.body.appendChild(containerEl);
}

const map = new maplibregl.Map({
  container: containerId,
  style: STYLE_URL,
  center: [START_LNG, START_LAT],
  zoom: START_ZOOM
});

async function fetchPoints() {
  const res = await fetch(`${API_BASE}/api/points?ts=${Date.now()}`); // cache-bust
  const fc = await res.json();
  if (LAST_ONLY && Array.isArray(fc.features) && fc.features.length) {
    fc.features = [fc.features[fc.features.length - 1]];
  }
  return fc;
}

async function addOrUpdateSource() {
  const fc = await fetchPoints();
  const src = map.getSource('points');

  if (src) {
    // Update in place (no duplicate layers)
    src.setData(fc);
    return fc;
  }

  // First time: create source + layers
  map.addSource('points', { type: 'geojson', data: fc });

  // Simple circle layer (no clustering; easy to switch on later)
  map.addLayer({
    id: 'points',
    type: 'circle',
    source: 'points',
    paint: {
      'circle-radius': 5,
      'circle-color': '#2463EB', // default blue-ish
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1
    }
  });

  return fc;
}

function fitToFeatures(fc) {
  if (!fc?.features?.length) return;
  const coords = fc.features.map(f => f.geometry.coordinates);
  const bounds = coords.reduce(
    (b, [x, y]) => b.extend([x, y]),
    new maplibregl.LngLatBounds(coords[0], coords[0])
  );
  map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
}

map.on('load', async () => {
  const fc = await addOrUpdateSource();
  fitToFeatures(fc);

  // Auto-refresh without stacking layers
  setInterval(async () => {
    const updated = await addOrUpdateSource();
    if (LAST_ONLY) fitToFeatures(updated); // keep camera on the newest point if LAST_ONLY
  }, REFRESH_MS);
});

// (Optional) click to inspect a point
map.on('click', 'points', (e) => {
  const f = e.features?.[0];
  if (!f) return;
  const { value } = f.properties || {};
  const [lng, lat] = f.geometry.coordinates;
  new maplibregl.Popup()
    .setLngLat([lng, lat])
    .setHTML(`<div style="min-width:140px">
        <strong>Reading</strong><br/>
        NTU: ${value ?? '—'}
      </div>`)
    .addTo(map);
});

map.on('mouseenter', 'points', () => map.getCanvas().style.cursor = 'pointer');
map.on('mouseleave', 'points', () => map.getCanvas().style.cursor = '');
