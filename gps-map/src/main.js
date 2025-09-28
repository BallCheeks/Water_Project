// Tp6EzxIVbiDmr80nzdV0
// src/main.js

import './style.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';

// ── YOUR STYLE (unchanged) ─────────────────────────────────────────────────────
const STYLE_URL =
  'https://api.maptiler.com/maps/streets/style.json?key=Tp6EzxIVbiDmr80nzdV0';

// ── REFRESH SETTINGS ───────────────────────────────────────────────────────────
const API_BASE    = 'http://localhost:3000';
const REFRESH_MS  = 10_000;      // refresh cadence (10s to match Arduino)
const LAST_ONLY   = true;        // true = keep just the newest marker

// ── MAP ────────────────────────────────────────────────────────────────────────
const map = new maplibregl.Map({
  container: 'map',
  style: STYLE_URL,
  center: [-118.25, 34.05],
  zoom: 8
});

// Track current markers so we can remove them before re-adding
let markers = [];
let didFitOnce = false;

// ── MARKER RENDERING ──────────────────────────────────────────────────────────
const DROP_SIZE  = 55;  // px
const VIEWBOX    = 24;  // internal SVG units
const FONT_UNITS = 6;   // font-size in SVG units

const colorForValue = (v) => {
  if (v == null || isNaN(v)) return '#95a5a6'; // gray if missing
  if (v <= 30) return '#2ecc71';
  if (v <= 50) return '#f1c40f';
  if (v <= 70) return '#e67e22';
  return '#e74c3c';
};

function makeMarkerElement(value) {
  const fill = colorForValue(value);
  const display = (value == null || isNaN(value)) ? '—' : String(value);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
         viewBox="0 0 ${VIEWBOX} ${VIEWBOX}"
         width="${DROP_SIZE}" height="${DROP_SIZE}">
      <path
        d="M12 2C8 8 6 12 6 16a6 6 0 0 0 12 0c0-4-2-8-6-14z"
        fill="${fill}"
        stroke="#ffffff"
        stroke-width="1"/>
      <text x="${VIEWBOX/2}" y="${VIEWBOX*0.65}"
            font-size="${FONT_UNITS}"
            font-family="Arial, sans-serif"
            font-weight="bold"
            text-anchor="middle"
            fill="#000">
        ${display}
      </text>
    </svg>`.trim();

  const el = document.createElement('div');
  el.innerHTML = svg;
  el.style.width  = `${DROP_SIZE}px`;
  el.style.height = `${DROP_SIZE}px`;
  return el;
}

function clearMarkers() {
  for (const m of markers) m.remove();
  markers = [];
}

function renderMarkers(features) {
  clearMarkers();

  // Optionally keep only the most recent point
  const list = (LAST_ONLY && features.length) ? [features[features.length - 1]] : features;

  for (const { geometry: { coordinates }, properties } of list) {
    const el = makeMarkerElement(properties?.value);
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat(coordinates)
      .addTo(map);
    markers.push(marker);
  }

  // Fit once on first render so the point is in view
  if (!didFitOnce && list.length) {
    const [lng, lat] = list[0].geometry.coordinates;
    didFitOnce = true;
    map.fitBounds(new maplibregl.LngLatBounds([lng, lat], [lng, lat]).pad(0.3), { maxZoom: 14 });
  }
}

// ── DATA LOAD + REFRESH ───────────────────────────────────────────────────────
async function loadAndRender() {
  try {
    const r = await fetch(`${API_BASE}/api/points?ts=${Date.now()}`); // cache-bust
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const { features = [] } = await r.json();
    renderMarkers(features);
  } catch (err) {
    console.error('Error loading points:', err);
  }
}

map.on('load', () => {
  // initial draw
  loadAndRender();
  // periodic refresh that removes the previous marker(s) first
  setInterval(loadAndRender, REFRESH_MS);
});
