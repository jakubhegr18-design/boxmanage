const express = require('express');
const crypto = require('node:crypto');
const { db, touchBox, logMovement } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  const locationId = req.query.location ? Number(req.query.location) : null;
  const position = String(req.query.position || '').trim().toLowerCase();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];
  if (search) {
    where.push('(LOWER(b.name) LIKE ? OR LOWER(b.description) LIKE ? OR LOWER(b.position) LIKE ? OR b.id LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (locationId) {
    where.push('b.location_id = ?');
    params.push(locationId);
  }
  if (position) {
    where.push('LOWER(b.position) = ?');
    params.push(position);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM boxes b ${whereSql}`).get(...params).c;

  const items = db.prepare(`
    SELECT b.*, l.name AS location_name,
      (SELECT COUNT(*) FROM items i WHERE i.box_id = b.id) AS item_count
    FROM boxes b
    LEFT JOIN locations l ON l.id = b.location_id
    ${whereSql}
    ORDER BY b.updated_at DESC, b.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

router.get('/:id', requireAuth, (req, res) => {
  const box = getBox(req.params.id);
  if (!box) return res.status(404).json({ error: 'Krabice nenalezena' });
  box.items = db.prepare('SELECT * FROM items WHERE box_id = ? ORDER BY name').all(box.id);
  box.movements = db.prepare(`
    SELECT m.*, u.username
    FROM movements m
    LEFT JOIN users u ON u.id = m.user_id
    WHERE m.box_id = ?
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 50
  `).all(box.id);
  res.json(box);
});

router.post('/', requireAuth, (req, res) => {
  const { name, description, position, locationId, id } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Název je povinný' });

  // ID se dá zadat (např. z naskenovaného QR štítku); jinak se vygeneruje nové UUID.
  let boxId = 'bm-' + crypto.randomUUID();
  if (id !== undefined && id !== null && String(id).trim() !== '') {
    const requestedId = String(id).trim();
    if (requestedId.length > 100 || !/^[a-zA-Z0-9._-]+$/.test(requestedId)) {
      return res.status(400).json({ error: 'Neplatné ID: jen písmena, číslice, tečka, podtržítko a pomlčka (max 100 znaků)' });
    }
    if (db.prepare('SELECT 1 FROM boxes WHERE id = ?').get(requestedId)) {
      return res.status(409).json({ error: 'Krabice s tímto ID už existuje' });
    }
    boxId = requestedId;
  }

  const pos = String(position || '').trim().toUpperCase();
  db.prepare(`
    INSERT INTO boxes (id, name, description, position, location_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(boxId, String(name).trim(), String(description || '').trim(), pos,
    locationId ? Number(locationId) : null, req.user.id);
  logMovement(boxId, req.user.id, 'created', { name: String(name).trim(), position: pos, location_id: locationId || null });
  res.status(201).json(getBox(boxId));
});

router.patch('/:id', requireAuth, (req, res) => {
  const box = getBox(req.params.id);
  if (!box) return res.status(404).json({ error: 'Krabice nenalezena' });
  const { name, description, position, locationId } = req.body || {};
  const changes = [];
  const updates = [];
  const params = [];

  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: 'Název je povinný' });
    updates.push('name = ?'); params.push(String(name).trim());
    if (String(name).trim() !== box.name) changes.push(`název: ${box.name} → ${String(name).trim()}`);
  }
  if (description !== undefined) {
    updates.push('description = ?'); params.push(String(description || '').trim());
  }
  if (position !== undefined) {
    const pos = String(position || '').trim().toUpperCase();
    updates.push('position = ?'); params.push(pos);
    if (pos !== box.position) changes.push(`pozice: ${box.position || '—'} → ${pos || '—'}`);
  }
  if (locationId !== undefined) {
    const loc = locationId ? Number(locationId) : null;
    updates.push('location_id = ?'); params.push(loc);
    const oldName = box.location_name || '—';
    const newName = loc ? (db.prepare('SELECT name FROM locations WHERE id = ?').get(loc)?.name || '?') : '—';
    changes.push(`lokace: ${oldName} → ${newName}`);
  }

  if (updates.length) {
    updates.push('updated_at = datetime(\'now\')');
    db.prepare(`UPDATE boxes SET ${updates.join(', ')} WHERE id = ?`).run(...params, box.id);
    if (changes.length) logMovement(box.id, req.user.id, 'updated', { changes });
  }
  res.json(getBox(box.id));
});

router.delete('/:id', requireAuth, (req, res) => {
  const box = getBox(req.params.id);
  if (!box) return res.status(404).json({ error: 'Krabice nenalezena' });
  db.prepare('DELETE FROM boxes WHERE id = ?').run(box.id);
  logMovement(box.id, req.user.id, 'deleted', { name: box.name });
  res.json({ ok: true });
});

router.post('/:id/position', requireAuth, (req, res) => {
  const box = getBox(req.params.id);
  if (!box) return res.status(404).json({ error: 'Krabice nenalezena' });
  const pos = String(req.body?.position || '').trim().toUpperCase();
  db.prepare('UPDATE boxes SET position = ?, updated_at = datetime(\'now\') WHERE id = ?').run(pos, box.id);
  if (pos !== box.position) {
    logMovement(box.id, req.user.id, 'position_changed', { from: box.position, to: pos });
  }
  res.json(getBox(box.id));
});

router.post('/:id/move', requireAuth, (req, res) => {
  const box = getBox(req.params.id);
  if (!box) return res.status(404).json({ error: 'Krabice nenalezena' });
  const loc = req.body?.locationId ? Number(req.body.locationId) : null;
  const oldName = box.location_name || '—';
  const newName = loc ? (db.prepare('SELECT name FROM locations WHERE id = ?').get(loc)?.name || '?') : '—';
  db.prepare('UPDATE boxes SET location_id = ?, updated_at = datetime(\'now\') WHERE id = ?').run(loc, box.id);
  logMovement(box.id, req.user.id, 'moved', { from: oldName, to: newName });
  res.json(getBox(box.id));
});

function getBox(id) {
  const box = db.prepare(`
    SELECT b.*, l.name AS location_name
    FROM boxes b
    LEFT JOIN locations l ON l.id = b.location_id
    WHERE b.id = ?
  `).get(String(id));
  if (box) box.location_name = box.location_name || '';
  return box;
}

module.exports = router;
