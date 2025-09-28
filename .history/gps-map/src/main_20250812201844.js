// src/main.js — MapLibre + ONE live marker that moves/updates text (no extra layers)

import maplibregl from 'maplibre-gl';

// ======== YOUR KNOBS (edit if needed) ========
const API_BASE        = import.meta?.env?.VITE_API_BASE || 'http://localhost:3000';
const STYLE_URL       = import.meta?.env?.VITE_STYLE_URL || 'https://demotiles.maplibre.org/style.json';
const START_LNG       = Number(import.meta?.env?.VITE_START_LNG ?? -117.686);
const START_LAT       = Number(import.meta?.env?.VITE_START_LAT ?? 33.646);
const START_ZOOM      = Number(import.meta?.env?.VITE_START_ZOOM ?? 12);
const REFRESH_MS      = Number(import.meta?.env?.VITE_REFRESH_MS ?? 10_000); // 10s to match Arduino
const FETCH_TIMEOUTMS = 8000;
// =============================================

// Ensure a map container exists (in case HTML forgot it)
const containerId = 'map';
let el = document.getElementById(containerId);
if (!el) {
  el = document.createElement('div');
  el.id = containerId;
  el.style.height = '100vh';
  document.body.style.margin = '0';
  document.body.appendChild(el);
}

// Create your map (keeps your style/center)
const map = new maplibregl.Map({
  container: containerId,
  style: STYLE_URL,
  center: [START_LNG, START_LAT],
  zoom: START_ZOOM
});

// Nice defaults (optional)
map.addControl(new maplibregl.NavigationControl(), 'top-right');
map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }));

// ======== SINGLE MARKER LOGIC (no layers/sources added) ========
let latestMarker = null;
let latestPopup  = null;
let didInitialFit = false;

function abortableFetch(url, timeoutMs = FETCH_TIMEOUTMS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { signal: ctrl.signal })
    .finally(() => clearTimeout(t));
}

async function fetchLatestFeature() {
  try {
    // cache-bust so we always get the newest JSON
    const res = await abortableFetch(`${API_BASE}/api/points?ts=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const fc = await res.json();
    if (!fc?.features?.length) return null;
    // Treat the last feature as newest
    return fc.features[fc.features.length - 1];
  } catch (e) {
    console.warn('[latest] fetch failed:', e?.message || e);
    return null;
  }
}

function popupHTML(props = {}) {
  const { value, voltage, raw } = props;
  return `
    <div style="min-width:160px">
      <strong>Latest reading</strong><br/>
      NTU: ${value ?? '—'}<br/>
      V: ${voltage ?? '—'}<br/>
      Raw: ${raw ?? '—'}
    </div>`;
}

async function refreshLatestMarker() {
  const f = await fetchLatestFeature();
  if (!f) return;

  const [lng, lat] = f.geometry.coordinates;
  const html = popupHTML(f.properties || {});

  if (!latestMarker) {
    latestPopup = new maplibregl.Popup({ closeButton: false }).setHTML(html);
    latestMarker = new maplibregl.Marker({ color: '#2463EB' })
      .setLngLat([lng, lat])
      .setPopup(latestPopup)
      .addTo(map);

    // Fit once on first load to make sure it's in view
    if (!didInitialFit) {
      didInitialFit = true;
      map.fitBounds(new maplibregl.LngLatBounds([lng, lat], [lng, lat]).pad(0.3), { maxZoom: 15 });
    }
  } else {
    // Move existing marker (removes the previous position visually)
    latestMarker.setLngLat([lng, lat]);
    latestPopup.setHTML(html); // update text
  }
}

// Start the loop without touching your existing rendering
map.on('load', () => {
  refreshLatestMarker();
  setInterval(refreshLatestMarker, REFRESH_MS);
});
