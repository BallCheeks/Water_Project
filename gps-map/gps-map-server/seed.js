const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('points.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lon REAL NOT NULL,
    lat REAL NOT NULL,
    value INTEGER NOT NULL CHECK(value BETWEEN 0 AND 100)
  )`);

  const stmt = db.prepare(`INSERT INTO points (lon, lat, value) VALUES (?, ?, ?)`);
  const sample = [
    [138.5483, -40.9125, 72],
    [-105.95, 28.8308, 74],
    [24.213, -3.447, 50],
    [-84.9935, -61.762, 96],
    [134.6337, 25.4541, 50],
    [29.1479, -56.1887, 6],
    [-99.577, -50.2132, 37],
    [120.624, 50.2994, 24],
    [-146.2548, -84.1049, 77],
    [122.9715, 4.9799, 95],
    [116.7506, 76.0528, 12],
    [-126.5608, 77.7924, 57],
    [53.4071, -36.3868, 22],
    [-103.2535, 15.5459, 68],
    [-6.4398, -43.9345, 51],

  ];
  sample.forEach(([lon, lat, v]) => stmt.run(lon, lat, v));
  stmt.finalize();
});

db.close();
