const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'boxmanage.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS boxes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    position TEXT DEFAULT '',
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_boxes_name ON boxes(name);
  CREATE INDEX IF NOT EXISTS idx_boxes_position ON boxes(position);
  CREATE INDEX IF NOT EXISTS idx_boxes_location ON boxes(location_id);

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    box_id TEXT NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_items_box ON items(box_id);

  CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    box_id TEXT REFERENCES boxes(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    detail TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_movements_box ON movements(box_id);
  CREATE INDEX IF NOT EXISTS idx_movements_time ON movements(created_at);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

function getSetting(key, def) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : def;
}

function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

let jwtSecret = getSetting('jwt_secret', null);
if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(48).toString('hex');
  setSetting('jwt_secret', jwtSecret);
}

function ensureAdminUser() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users WHERE role = ?').get('admin').c;
  if (count === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin';
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
      .run(username, hash, 'admin');
    console.log(`[boxmanage] First run: admin user created -> username: ${username}  password: ${password}`);
    console.log('[boxmanage] IMPORTANT: change this password in the app!');
  }
}

function touchBox(boxId) {
  db.prepare('UPDATE boxes SET updated_at = datetime(\'now\') WHERE id = ?').run(boxId);
}

function logMovement(boxId, userId, action, detail) {
  db.prepare('INSERT INTO movements (box_id, user_id, action, detail) VALUES (?, ?, ?, ?)')
    .run(boxId, userId, action, detail === undefined || detail === null ? '' : JSON.stringify(detail));
}

module.exports = { db, getSetting, setSetting, jwtSecret, ensureAdminUser, touchBox, logMovement, dataDir };
