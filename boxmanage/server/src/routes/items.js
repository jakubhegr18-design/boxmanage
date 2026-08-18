const express = require('express');
const { db, touchBox, logMovement } = require('../db');
const { requireAuth } = require('../auth');
const { checkItemAlert } = require('../telegram');

const router = express.Router();

// Hledání položek napříč všemi krabicemi (q = část názvu, box = ID krabice).
// Jména polí odpovídají modelu položky z detailu krabice (name, quantity, unit…),
// navíc box_id / box_name / box_position / location_name pro zobrazení a navigaci.
router.get('/items', requireAuth, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const box = String(req.query.box || '').trim();
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

  const where = [];
  const params = [];
  if (q) {
    where.push('LOWER(i.name) LIKE ?');
    params.push(`%${q}%`);
  }
  if (box) {
    where.push('i.box_id = ?');
    params.push(box);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT i.id, i.box_id, b.name AS box_name, b.position AS box_position,
      COALESCE(l.name, '') AS location_name,
      i.name, i.quantity, i.unit, i.alert_threshold, i.alert_enabled
    FROM items i
    JOIN boxes b ON b.id = i.box_id
    LEFT JOIN locations l ON l.id = b.location_id
    ${whereSql}
    ORDER BY LOWER(i.name), i.id
    LIMIT ?
  `).all(...params, limit);

  res.json({ items: rows, total: rows.length });
});

router.post('/boxes/:boxId/items', requireAuth, (req, res) => {
  const { name, quantity, unit, alertEnabled } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Název položky je povinný' });
  const box = db.prepare('SELECT id, name FROM boxes WHERE id = ?').get(req.params.boxId);
  if (!box) return res.status(404).json({ error: 'Krabice nenalezena' });
  const qty = quantity === undefined || quantity === null ? 0 : Number(quantity);
  const r = db.prepare('INSERT INTO items (box_id, name, quantity, unit, alert_enabled) VALUES (?, ?, ?, ?, ?)')
    .run(box.id, String(name).trim(), isNaN(qty) ? 0 : qty, String(unit || '').trim(), alertEnabled === false ? 0 : 1);
  touchBox(box.id);
  logMovement(box.id, req.user.id, 'item_added', {
    item: String(name).trim(), quantity: isNaN(qty) ? 0 : qty, unit: String(unit || '').trim(),
  });
  res.status(201).json(db.prepare('SELECT * FROM items WHERE id = ?').get(r.lastInsertRowid));
});

router.patch('/items/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Položka nenalezena' });
  const { name, quantity, unit, alertThreshold, alertEnabled } = req.body || {};
  if (name !== undefined && !String(name).trim()) return res.status(400).json({ error: 'Název je povinný' });
  if (name !== undefined) db.prepare('UPDATE items SET name = ? WHERE id = ?').run(String(name).trim(), item.id);
  if (unit !== undefined) db.prepare('UPDATE items SET unit = ? WHERE id = ?').run(String(unit).trim(), item.id);
  if (quantity !== undefined) {
    const qty = Number(quantity);
    db.prepare('UPDATE items SET quantity = ? WHERE id = ?').run(isNaN(qty) ? 0 : qty, item.id);
  }
  if (alertThreshold !== undefined) {
    const t = alertThreshold === null || alertThreshold === '' ? null : Number(alertThreshold);
    db.prepare('UPDATE items SET alert_threshold = ? WHERE id = ?').run(t === null || isNaN(t) ? null : t, item.id);
  }
  if (alertEnabled !== undefined) {
    db.prepare('UPDATE items SET alert_enabled = ? WHERE id = ?').run(alertEnabled ? 1 : 0, item.id);
  }
  touchBox(item.box_id);
  logMovement(item.box_id, req.user.id, 'item_updated', { item: item.name });
  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(item.id);
  checkItemAlert(item.id, item.quantity).catch(() => {});
  res.json(updated);
});

router.post('/items/:id/add', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Položka nenalezena' });
  const qty = Number(req.body?.quantity);
  if (!isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'Neplatné množství' });
  db.prepare('UPDATE items SET quantity = quantity + ? WHERE id = ?').run(qty, item.id);
  touchBox(item.box_id);
  logMovement(item.box_id, req.user.id, 'quantity_added', { item: item.name, quantity: qty, unit: item.unit });
  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(item.id);
  checkItemAlert(item.id, item.quantity).catch(() => {});
  res.json(updated);
});

router.post('/items/:id/remove', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Položka nenalezena' });
  const qty = Number(req.body?.quantity);
  if (!isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'Neplatné množství' });
  const newQty = Math.max(0, item.quantity - qty);
  db.prepare('UPDATE items SET quantity = ? WHERE id = ?').run(newQty, item.id);
  touchBox(item.box_id);
  logMovement(item.box_id, req.user.id, 'quantity_removed', { item: item.name, quantity: qty, unit: item.unit });
  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(item.id);
  checkItemAlert(item.id, item.quantity).catch(() => {});
  res.json(updated);
});

router.delete('/items/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Položka nenalezena' });
  db.prepare('DELETE FROM items WHERE id = ?').run(item.id);
  touchBox(item.box_id);
  logMovement(item.box_id, req.user.id, 'item_deleted', { item: item.name });
  res.json({ ok: true });
});

module.exports = router;
