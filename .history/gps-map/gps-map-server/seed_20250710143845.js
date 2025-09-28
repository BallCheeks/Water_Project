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
  ];
  sample.forEach(([lon, lat, v]) => stmt.run(lon, lat, v));
  stmt.finalize();
});

db.close();
