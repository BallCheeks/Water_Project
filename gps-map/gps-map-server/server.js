// server.js — API with optional turbidity "value"
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ---- DB ----
// SCHEMA: value is OPTIONAL (nullable), lat/lon OPTIONAL too.
// If your existing DB was created with NOT NULL on value, see migration steps below.
const db = new sqlite3.Database('points.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY,
    ts INTEGER,
    lat REAL,
    lon REAL,
    value REAL,      -- optional
    voltage REAL,    -- optional
    source TEXT
  )`);
});

// ---- Ingest ----
// Accepts JSON: { id?, ts?, lat?, lon?, value?, voltage?, source? }
app.post('/api/ingest', (req, res) => {
  console.log('[INGEST]', req.body);
  const { id, ts, lat, lon, value, voltage, source } = req.body || {};

  const _id = (typeof id === 'number' && Number.isFinite(id)) ? id : null;
  const _ts = (typeof ts === 'number' && Number.isFinite(ts)) ? ts : Math.floor(Date.now() / 1000);
  const _lat = (typeof lat === 'number' && Number.isFinite(lat)) ? lat : null;
  const _lon = (typeof lon === 'number' && Number.isFinite(lon)) ? lon : null;
  const _value = (typeof value === 'number' && Number.isFinite(value)) ? value : null;     // optional
  const _voltage = (typeof voltage === 'number' && Number.isFinite(voltage)) ? voltage : null; // optional
  const _source = (typeof source === 'string' && source.length) ? source : 'device';

  if (_id !== null) {
    // Upsert by id
    db.run(
      `INSERT INTO points (id, ts, lat, lon, value, voltage, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         ts=excluded.ts,
         lat=excluded.lat,
         lon=excluded.lon,
         value=excluded.value,
         voltage=excluded.voltage,
         source=excluded.source`,
      [_id, _ts, _lat, _lon, _value, _voltage, _source],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        return res.json({ ok: true, id: _id });
      }
    );
  } else {
    // Insert auto id
    db.run(
      `INSERT INTO points (ts, lat, lon, value, voltage, source)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [_ts, _lat, _lon, _value, _source === 'device' ? 'uno-r4' : _source, _voltage], // keep order aligned
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        return res.json({ ok: true, id: this.lastID });
      }
    );
  }
});

// ---- Map endpoint ----
// Only return rows that have coordinates; value may be null.
app.get('/api/points', (req, res) => {
  db.all('SELECT lon, lat, value FROM points WHERE lat IS NOT NULL AND lon IS NOT NULL', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const features = rows.map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
      properties: { value: r.value }
    }));
    res.json({ type: 'FeatureCollection', features });
  });
});

// ---- Debug listing (optional) ----
app.get('/api/debug/all', (req, res) => {
  db.all('SELECT * FROM points ORDER BY id DESC LIMIT 100', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
