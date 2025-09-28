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
const CLUSTER    = (import.meta?.env?.VITE_CLUSTER ?? 'false') === 'true';  // set true to enable clustering
const FETCH_TIMEOUT_MS = 8000;
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

// ======== LIVE POINTS (non-destructive) ========
const SRC_ID = 'water-points-src';
const LYR_POINTS = 'water-points';
const LYR_CLUSTERS = 'water-clusters';
const LYR_CLUSTER_COUNT = 'water-cluster-count';

function abortableFetch(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { signal: ctrl.signal })
    .finally(() => clearTimeout(t));
}

async function fetchPoints() {
  try {
    const r = await abortableFetch(`${API_BASE}/api/points?ts=${Date.now()}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const fc = await r.json();
    if (LAST_ONLY && Array.isArray(fc.features) && fc.features.length) {
      fc.features = [fc.features[fc.features.length - 1]];
    }
    return fc;
  } catch (e) {
    console.warn('[points] fetch failed:', e?.message || e);
    // keep previous data if any; return empty collection otherwise
    return { type: 'FeatureCollection', features: [] };
  }
}

async function addOrUpdate() {
  const fc = await fetchPoints();
  const src = map.getSource(SRC_ID);

  if (src) {
    // ✅ Update existing source (replaces previous marker(s))
    src.setData(fc);
    return fc;
  }

  // First time: create source
  map.addSource(SRC_ID, CLUSTER ? {
    type: 'geojson',
    data: fc,
    cluster: true,
    clusterRadius: 40,
    clusterMaxZoom: 14
  } : {
    type: 'geojson',
    data: fc
  });

  // Layers (either clustered or simple circles)
  if (CLUSTER) {
    if (!map.getLayer(LYR_CLUSTERS)) {
      map.addLayer({
        id: LYR_CLUSTERS,
        type: 'circle',
        source: SRC_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 25, 24],
          'circle-color': ['step', ['get', 'point_count'], '#A0C4FF', 10, '#90EE90', 25, '#FFB3C1'],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1
        }
      });
    }
    if (!map.getLayer(LYR_CLUSTER_COUNT)) {
      map.addLayer({
        id: LYR_CLUSTER_COUNT,
        type: 'symbol',
        source: SRC_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count'],
          'text-size': 12
        },
        paint: { 'text-color': '#1f2937' }
      });
    }
    if (!map.getLayer(LYR_POINTS)) {
      map.addLayer({
        id: LYR_POINTS,
        type: 'circle',
        source: SRC_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 5,
          'circle-color': '#2463EB',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1
        }
      });
    }
  } else {
    if (!map.getLayer(LYR_POINTS)) {
      map.addLayer({
        id: LYR_POINTS,
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
  }

  return fc;
}

let fitTimeout = null;
function fitToFeatures(fc) {
  if (!fc?.features?.length) return;
  if (fitTimeout) clearTimeout(fitTimeout);
  // Debounce fit so frequent updates don’t jitter the camera
  fitTimeout = setTimeout(() => {
    const coords = fc.features.map(f => f.geometry.coordinates);
    const bounds = coords.reduce(
      (b, [x, y]) => b.extend([x, y]),
      new maplibregl.LngLatBounds(coords[0], coords[0])
    );
    map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
  }, 150);
}

map.on('load', async () => {
  const fc = await addOrUpdate();
  fitToFeatures(fc);                 // center/zoom to current data once

  // Refresh without stacking — ONLY updates the source data
  setInterval(async () => {
    const updated = await addOrUpdate();
    if (LAST_ONLY) fitToFeatures(updated); // follow the newest point if LAST_ONLY
  }, REFRESH_MS);
});

// (Optional) click-popup for NTU value (shows "—" if value is null)
map.on('click', LYR_POINTS, (e) => {
  const f = e.features?.[0];
  if (!f) return;
  const props = f.properties || {};
  const value = props.value ?? '—';
  const voltage = props.voltage ?? '—';
  const raw = props.raw ?? '—';
  const [lng, lat] = f.geometry.coordinates;
  new maplibregl.Popup()
    .setLngLat([lng, lat])
    .setHTML(
      `<div style="min-width:160px">
        <strong>Reading</strong><br/>
        NTU: ${value}<br/>
        V: ${voltage}<br/>
        Raw: ${raw}
      </div>`
    )
    .addTo(map);
});
map.on('mouseenter', LYR_POINTS, () => map.getCanvas().style.cursor = 'pointer');
map.on('mouseleave', LYR_POINTS, () => map.getCanvas().style.cursor = '');

// Cluster click to zoom in (only if clustering is on)
if (CLUSTER) {
  map.on('click', LYR_CLUSTERS, (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: [LYR_CLUSTERS] });
    const clusterId = features[0]?.properties?.cluster_id;
    if (clusterId == null) return;
    map.getSource(SRC_ID).getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      map.easeTo({ center: features[0].geometry.coordinates, zoom });
    });
  });
  map.on('mouseenter', LYR_CLUSTERS, () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', LYR_CLUSTERS, () => map.getCanvas().style.cursor = '');
}
