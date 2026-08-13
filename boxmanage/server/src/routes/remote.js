const crypto = require('node:crypto');
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// Živé připojení dálkového skeneru — server → PC (Server-Sent Events).
// Map<sessionToken, Set<ExpressResponse>>
const sseClients = new Map();

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bez 0/O/1/I kvůli záměně
const CODE_LEN = 6;

function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LEN; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function cleanupOldSessions() {
  db.prepare('DELETE FROM remote_sessions WHERE created_at < datetime(\'now\', \'-7 days\')').run();
}

function broadcastToSession(token, event) {
  const clients = sseClients.get(token);
  if (!clients || !clients.size) return;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { /* ignore */ }
  }
}

// Záznam naskenování krabice do fronty dálkového skeneru (volá se z boxes.js).
function recordRemoteScan({ boxId, userId, sessionToken }) {
  if (!sessionToken) return null;
  const session = db.prepare('SELECT token FROM remote_sessions WHERE token = ?').get(sessionToken);
  if (!session) return null;
  const r = db.prepare('INSERT INTO remote_events (session_token, box_id, user_id) VALUES (?, ?, ?)')
    .run(sessionToken, boxId, userId);
  const row = db.prepare(`
    SELECT e.*, b.name AS box_name, b.position AS box_position, u.username
    FROM remote_events e
    LEFT JOIN boxes b ON b.id = e.box_id
    LEFT JOIN users u ON u.id = e.user_id
    WHERE e.id = ?
  `).get(r.lastInsertRowid);
  broadcastToSession(sessionToken, row);
  return row;
}

function getEvents(token) {
  return db.prepare(`
    SELECT e.*, b.name AS box_name, b.position AS box_position, u.username
    FROM remote_events e
    LEFT JOIN boxes b ON b.id = e.box_id
    LEFT JOIN users u ON u.id = e.user_id
    WHERE e.session_token = ?
    ORDER BY e.resolved ASC, e.created_at DESC, e.id DESC
    LIMIT 200
  `).all(token);
}

// --- Vytvoření / seznam session -------------------------------------------------

router.post('/sessions', requireAuth, (req, res) => {
  cleanupOldSessions();
  const token = crypto.randomBytes(24).toString('hex');
  let code = generateCode();
  while (db.prepare('SELECT 1 FROM remote_sessions WHERE code = ?').get(code)) code = generateCode();
  db.prepare('INSERT INTO remote_sessions (token, code, created_by) VALUES (?, ?, ?)')
    .run(token, code, req.user.id);
  res.status(201).json({ token, code });
});

router.get('/sessions', requireAuth, (req, res) => {
  const sessions = db.prepare('SELECT * FROM remote_sessions WHERE created_by = ? ORDER BY created_at DESC LIMIT 10')
    .all(req.user.id);
  res.json({ sessions });
});

// --- Spárování mobilu se skenerem pomocí kódu -----------------------------------

router.post('/join', requireAuth, (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Zadej kód ze skeneru' });
  const s = db.prepare('SELECT * FROM remote_sessions WHERE code = ?').get(code);
  if (!s) return res.status(404).json({ error: 'Kód neplatný — zkontroluj ho na PC' });
  res.json({ token: s.token, code: s.code });
});

// --- Práce se session ------------------------------------------------------------

router.get('/:token', requireAuth, (req, res) => {
  const s = db.prepare('SELECT * FROM remote_sessions WHERE token = ?').get(req.params.token);
  if (!s) return res.status(404).json({ error: 'Session neexistuje' });
  res.json({ session: s });
});

router.delete('/:token', requireAuth, (req, res) => {
  const s = db.prepare('SELECT * FROM remote_sessions WHERE token = ?').get(req.params.token);
  if (!s) return res.status(404).json({ error: 'Session neexistuje' });
  db.prepare('DELETE FROM remote_sessions WHERE token = ?').run(s.token);
  broadcastToSession(s.token, { closed: true });
  res.json({ ok: true });
});

// --- Fronta událostí -------------------------------------------------------------

router.get('/:token/events', requireAuth, (req, res) => {
  const s = db.prepare('SELECT * FROM remote_sessions WHERE token = ?').get(req.params.token);
  if (!s) return res.status(404).json({ error: 'Session neexistuje' });
  res.json({ session: s, events: getEvents(req.params.token) });
});

router.post('/:token/events/:id/resolve', requireAuth, (req, res) => {
  const e = db.prepare('SELECT * FROM remote_events WHERE id = ? AND session_token = ?')
    .get(req.params.id, req.params.token);
  if (!e) return res.status(404).json({ error: 'Událost nenalezena' });
  db.prepare('UPDATE remote_events SET resolved = 1 WHERE id = ?').run(e.id);
  res.json({ ok: true });
});

// --- Živý stream (SSE) — bez JWT hlavičky, token je v URL ------------------------
// Registrované až za /sessions, /join a /:token, aby tyto routy měly přednost.

router.get('/:token/stream', (req, res) => {
  const s = db.prepare('SELECT token FROM remote_sessions WHERE token = ?').get(req.params.token);
  if (!s) return res.status(404).json({ error: 'Session neexistuje' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');

  let clients = sseClients.get(req.params.token);
  if (!clients) { clients = new Set(); sseClients.set(req.params.token, clients); }
  clients.add(res);

  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* ignore */ }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
    if (!clients.size) sseClients.delete(req.params.token);
  });
});

module.exports = { remoteRouter: router, recordRemoteScan };
