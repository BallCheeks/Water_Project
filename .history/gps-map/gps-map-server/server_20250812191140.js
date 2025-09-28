// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('points.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY,
    ts INTEGER,
    lat REAL, lon REAL,
    value REAL,           -- NTU
    voltage REAL,         -- sensor voltage
    source TEXT
  )`);
});

// Arduino posts here
app.post('/api/ingest', (req, res) => {
  console.log('[INGEST]', req.body);
  const { id, ts, lat, lon, value, voltage, source } = req.body || {};
  if (typeof value !== 'number') return res.status(400).json({ error: 'value (NTU) required' });

  const _ts = typeof ts === 'number' ? ts : Math.floor(Date.now()/1000);
  const _lat = typeof lat === 'number' ? lat : null;
  const _lon = typeof lon === 'number' ? lon : null;
  const _voltage = typeof voltage === 'number' ? voltage : null;
  const _source = typeof source === 'string' ? source : 'uno-r4';

  if (typeof id === 'number') {
    db.run(
      `INSERT INTO points(id, ts, lat, lon, value, voltage, source)
       VALUES(?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET ts=excluded.ts, lat=excluded.lat, lon=excluded.lon,
                                    value=excluded.value, voltage=excluded.voltage, source=excluded.source`,
      [id, _ts, _lat, _lon, value, _voltage, _source],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ok: true, id });
      }
    );
  } else {
    db.run(
      `INSERT INTO points(ts, lat, lon, value, voltage, source) VALUES(?, ?, ?, ?, ?, ?)`,
      [_ts, _lat, _lon, value, _voltage, _source],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ok: true, id: this.lastID });
      }
    );
  }
});

// your map consumes this
app.get('/api/points', (req, res) => {
  db.all('SELECT lon, lat, value FROM points', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      type: 'FeatureCollection',
      features: rows.filter(r => r.lat != null && r.lon != null).map(r => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
        properties: { value: r.value }
      }))
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
