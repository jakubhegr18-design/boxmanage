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

  CREATE TABLE IF NOT EXISTS box_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    box_id TEXT NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    caption TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_box_photos_box ON box_photos(box_id);

  CREATE TABLE IF NOT EXISTS item_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    caption TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_item_photos_item ON item_photos(item_id);

  CREATE TABLE IF NOT EXISTS remote_sessions (
    token TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS remote_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_token TEXT NOT NULL REFERENCES remote_sessions(token) ON DELETE CASCADE,
    box_id TEXT REFERENCES boxes(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL DEFAULT 'scanned',
    detail TEXT DEFAULT '',
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_remote_events_session ON remote_events(session_token, created_at);
`);

// Migrace pro starší databáze (CREATE TABLE IF NOT EXISTS nepřidá sloupce do existující tabulky).
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('items', 'alert_threshold', 'REAL DEFAULT NULL');
ensureColumn('items', 'last_alert_at', 'TEXT DEFAULT NULL');
ensureColumn('items', 'alert_enabled', 'INTEGER DEFAULT 1');
ensureColumn('boxes', 'alert_enabled', 'INTEGER DEFAULT 1');
ensureColumn('locations', 'light_entity', "TEXT DEFAULT ''");
ensureColumn('locations', 'light_on_scan', 'INTEGER DEFAULT 0');

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
  // Logování pohybů je best-effort — pokud selže (např. FK konflikt při přechodu dat),
  // nesmí shodit samotnou operaci uživatele (uprchla by do 500).
  try {
    db.prepare('INSERT INTO movements (box_id, user_id, action, detail) VALUES (?, ?, ?, ?)')
      .run(boxId, userId, action, detail === undefined || detail === null ? '' : JSON.stringify(detail));
  } catch (err) {
    console.error('[boxmanage] Nepodařilo se zaznamenat pohyb:', err.message);
  }
}

module.exports = { db, getSetting, setSetting, jwtSecret, ensureAdminUser, touchBox, logMovement, dataDir };
