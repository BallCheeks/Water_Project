// water-logger.js — periodic water-quality logger (SQLite-based)
//
// Uses the existing points.db and the same `points` table already used by the server.
// Persists whatever sensor fields the project currently produces (value, voltage, lat, lon)
// plus a UNIX timestamp `ts` (seconds).

// ---- INTERVAL CONTROL ---------------------------------------------------------
// Single constant to control cadence. Demo default: 10s. Production: 300s (5 min).
const LOG_INTERVAL_SECONDS = 10; // ← change this to 300 for production

// On startup we print the effective interval.clear
console.log(`[logger] LOG_INTERVAL_SECONDS = ${LOG_INTERVAL_SECONDS}s`);

const sqlite3 = require('sqlite3').verbose();

// ---- DB -----------------------------------------------------------------------
// We extend the existing schema if needed; all sensor columns are OPTIONAL so we
// can persist only what we have.
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

// ---- SENSOR READING -----------------------------------------------------------
// If you provide ./sensor-provider.js that exports `getReading()` returning an
// object like { ts?, lat?, lon?, value?, voltage?, source? }, we'll use that.
// Otherwise we fall back to a safe demo generator.
let getReading;
try {
  ({ getReading } = require('./sensor-provider'));
  if (typeof getReading !== 'function') throw new Error('getReading is not a function');
  console.log('[logger] using sensor-provider.js');
} catch (_) {
  console.log('[logger] using demo generator (no sensor-provider.js found)');
  getReading = async () => ({
    ts: Math.floor(Date.now() / 1000),
    value: Math.round(Math.random() * 100),
    voltage: 5 + (Math.random() - 0.5) * 0.2,
    lat: null,
    lon: null,
    source: 'logger'
  });
}

// ---- INSERT -------------------------------------------------------------------
async function logOnce() {
  try {
    const r = await getReading();
    if (!r || typeof r !== 'object') return;

    const { ts, lat, lon, value, voltage, source } = r;
    const _ts = (typeof ts === 'number' && Number.isFinite(ts)) ? ts : Math.floor(Date.now() / 1000);
    const _lat = (typeof lat === 'number' && Number.isFinite(lat)) ? lat : null;
    const _lon = (typeof lon === 'number' && Number.isFinite(lon)) ? lon : null;
    const _value = (typeof value === 'number' && Number.isFinite(value)) ? value : null;
    const _voltage = (typeof voltage === 'number' && Number.isFinite(voltage)) ? voltage : null;
    const _source = (typeof source === 'string' && source.length) ? source : 'logger';

    db.run(
      `INSERT INTO points (ts, lat, lon, value, voltage, source) VALUES (?, ?, ?, ?, ?, ?)`,
      [_ts, _lat, _lon, _value, _voltage, _source],
      (err) => {
        if (err) return console.error('[logger] insert error:', err.message);
        // Optional: console.log('[logger] logged @', _ts);
      }
    );
  } catch (err) {
    console.error('[logger] read error:', err);
  }
}

// ---- LOOP ---------------------------------------------------------------------
setInterval(logOnce, LOG_INTERVAL_SECONDS * 1000);
