// src/main.js — MapLibre + live points from your Node API (no duplicate markers)

import maplibregl from 'maplibre-gl';

// ======== YOUR KNOBS (edit if needed) ========
const API_BASE   = import.meta?.env?.VITE_API_BASE || 'http://localhost:3000';
const STYLE_URL  = import.meta?.env?.VITE_STYLE_URL  || 'https://demotiles.maplibre.org/style.json'; // swap for yours
const START_LNG  = Number(import.meta?.env?.VITE_START_LNG ?? -117.686);
const START_LAT  = Number(import.meta?.env?.VITE_START_LAT ?? 33.646);
const START_ZOOM = Number(import.meta?.env?.VITE_START_ZOOM ?? 12);
const REFRESH_MS = Number(import.meta?.env?.VITE_REFRESH_MS ?? 10_000); // 10s to match Arduino posts
const LAST_ONLY  = (import.meta?.env?.VITE_LAST_ONLY ?? 'true') === 'true'; // true = show only latest point
// =============================================

// Ensure a map container exists (works even if your HTML forgot it)
const containerId = 'map';
let el = document.getElementById(containerId);
if (!el) {
  el = document.createElement('div');
  el.id = containerId;
  el.style.height = '100vh';
  document.body.style.margin = '0';
  document.body.appendChild(el);
}

// Create the map (KEEP/EDIT your style/center as needed)
const map = new maplibregl.Map({
  container: containerId,
  style: STYLE_URL,
  center: [START_LNG, START_LAT],
  zoom: START_ZOOM
});

// Nice defaults you can keep (optional)
map.addControl(new maplibregl.NavigationControl(), 'top-right');
map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }));

// ======== LIVE POINTS (my part; non-destructive) ========
const SRC_ID = 'water-points-src';
const LYR_ID = 'water-points';

async function fetchPoints() {
  const res = await fetch(`${API_BASE}/api/points?ts=${Date.now()}`); // cache-bust
  const fc = await res.json();
  if (LAST_ONLY && Array.isArray(fc.features) && fc.features.length) {
    fc.features = [fc.features[fc.features.length - 1]];
  }
  return fc;
}

async function addOrUpdate() {
  const fc = await fetchPoints();
  const src = map.getSource(SRC_ID);

  if (src) {
    // ✅ Update existing source (this replaces the old marker(s))
    src.setData(fc);
    return fc;
  }

  // First time: create source + one circle layer
  map.addSource(SRC_ID, { type: 'geojson', data: fc });

  if (!map.getLayer(LYR_ID)) {
    map.addLayer({
      id: LYR_ID,
      type: 'circle',
      source: SRC_ID,
      paint: {
        'circle-radius': 5,
        'circle-color': '#2463EB',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1
      }
    });
  }
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
  const fc = await addOrUpdate();
  fitToFeatures(fc);                 // center/zoom to current data once
  setInterval(async () => {          // refresh without stacking
    const updated = await addOrUpdate();
    if (LAST_ONLY) fitToFeatures(updated); // keep camera following the newest
  }, REFRESH_MS);
});

// (Optional) click-popup for NTU value (shows "—" if value is null)
map.on('click', LYR_ID, (e) => {
  const f = e.features?.[0];
  if (!f) return;
  const { value } = f.properties || {};
  const [lng, lat] = f.geometry.coordinates;
  new maplibregl.Popup()
    .setLngLat([lng, lat])
    .setHTML(`<div style="min-width:140px"><strong>Reading</strong><br/>NTU: ${value ?? '—'}</div>`)
    .addTo(map);
});
map.on('mouseenter', LYR_ID, () => map.getCanvas().style.cursor = 'pointer');
map.on('mouseleave', LYR_ID, () => map.getCanvas().style.cursor = '');
