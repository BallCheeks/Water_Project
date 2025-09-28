const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());

const db = new sqlite3.Database('points.db');

app.get('/api/points', (req, res) => {
  db.all('SELECT lon, lat, value FROM points', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const features = rows.map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
      properties: { value: r.value }
    }));
    res.json({ type: 'FeatureCollection', features });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
