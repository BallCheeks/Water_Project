// === Live points from your Node API (non-destructive) ===
(() => {
  const API_BASE   = 'http://localhost:3000';   // adjust if different
  const REFRESH_MS = 10_000;                    // 10s to match Arduino
  const LAST_ONLY  = true;                      // true = show only newest point
  const SRC_ID     = 'water-points-src';
  const LYR_ID     = 'water-points';

  async function fetchPoints() {
    const r = await fetch(`${API_BASE}/api/points?ts=${Date.now()}`); // cache-bust
    const fc = await r.json();
    if (LAST_ONLY && Array.isArray(fc.features) && fc.features.length) {
      fc.features = [fc.features[fc.features.length - 1]];
    }
    return fc;
  }

  async function addOrUpdate() {
    const fc = await fetchPoints();
    const src = map.getSource(SRC_ID);

    if (src) {
      // update existing source (this removes previous marker(s) from the map)
      src.setData(fc);
      return;
    }

    // first time: create source + one circle layer
    map.addSource(SRC_ID, { type: 'geojson', data: fc });

    // don't duplicate if user already has a layer with same id
    if (!map.getLayer(LYR_ID)) {
      map.addLayer({
        id: LYR_ID,
        type: 'circle',
        source: SRC_ID,
        paint: {
          'circle-radius': 5,
          'circle-color': '#2463EB',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1
        }
      });
    }
  }

  // Hook into your existing map
  if (map && typeof map.on === 'function') {
    map.on('load', async () => {
      await addOrUpdate();                     // initial load
      setInterval(addOrUpdate, REF
