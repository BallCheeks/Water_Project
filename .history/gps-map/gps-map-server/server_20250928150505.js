// server.js — Express API for WaterProject (SQLite + CORS + optional static)
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const app = express();

// --- CORS + JSON ---
app.use(cors({ origin: true }));
app.use(express.json());

// --- Basic-auth (optional): set DEMO_PW to enable a simple password gate ---
if (process.env.DEMO_PW) {
  const b64 = (s) => Buffer.from(s).toString("base64");
  const required = "Basic " + b64(`investor:${process.env.DEMO_PW}`);
  app.use((req, res, next) => {
    const got = req.headers.authorization || "";
    if (got === required) return next();
    res.setHeader("WWW-Authenticate", 'Basic realm="Restricted"');
    return res.status(401).send("Auth required");
  });
}

// --- SQLite setup ---
const defaultDbPath = path.join(__dirname, "data", "points.db");
const DB_PATH = process.env.DB_PATH || defaultDbPath;
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      value REAL,         -- nullable
      voltage REAL,       -- nullable
      lat REAL,           -- nullable
      lon REAL            -- nullable
    )`
  );
  db.run(`CREATE INDEX IF NOT EXISTS idx_points_ts ON points(ts)`);
});

// --- Health ---
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// --- Insert a point ---
app.post("/api/points", (req, res) => {
  const { value = null, voltage = null, lat = null, lon = null } = req.body || {};
  db.run(
    `INSERT INTO points (value, voltage, lat, lon) VALUES (?, ?, ?, ?)`,
    [value, voltage, lat, lon],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      return res.json({ id: this.lastID });
    }
  );
});

// --- List points ---
app.get("/api/points", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "100", 10), 1000);
  db.all(`SELECT * FROM points ORDER BY id DESC LIMIT ?`, [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- GeoJSON view ---
app.get("/api/geojson", (_req, res) => {
  db.all(`SELECT id, ts, value, voltage, lat, lon FROM points ORDER BY id DESC LIMIT 1000`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const features = rows
      .filter(r => r.lat != null && r.lon != null)
      .map(r => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lon, r.lat] },
        properties: { id: r.id, ts: r.ts, value: r.value, voltage: r.voltage }
      }));
    res.json({ type: "FeatureCollection", features });
  });
});

// --- Optional static serving (if you later build the Vite app into ../dist) ---
const distDir = path.resolve(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  // Serve static files
  app.use(express.static(distDir));
  // SPA fallback
  app.get("*", (req, res) => res.sendFile(path.join(distDir, "index.html")));
} else {
  // Friendly root when only the API is deployed
  app.get("/", (_req, res) => res.send("API OK. Try /api/health"));
}

// --- Listen ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API listening on ${PORT} (DB: ${DB_PATH})`);
});
