const express = require('express');
const { db, touchBox, logMovement } = require('../db');
const { requireAuth } = require('../auth');
const { checkItemAlert } = require('../telegram');

const router = express.Router();

router.post('/boxes/:boxId/items', requireAuth, (req, res) => {
  const { name, quantity, unit } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Název položky je povinný' });
  const box = db.prepare('SELECT id, name FROM boxes WHERE id = ?').get(req.params.boxId);
  if (!box) return res.status(404).json({ error: 'Krabice nenalezena' });
  const qty = quantity === undefined || quantity === null ? 0 : Number(quantity);
  const r = db.prepare('INSERT INTO items (box_id, name, quantity, unit) VALUES (?, ?, ?, ?)')
    .run(box.id, String(name).trim(), isNaN(qty) ? 0 : qty, String(unit || '').trim());
  touchBox(box.id);
  logMovement(box.id, req.user.id, 'item_added', {
    item: String(name).trim(), quantity: isNaN(qty) ? 0 : qty, unit: String(unit || '').trim(),
  });
  res.status(201).json(db.prepare('SELECT * FROM items WHERE id = ?').get(r.lastInsertRowid));
});

router.patch('/items/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Položka nenalezena' });
  const { name, quantity, unit, alertThreshold } = req.body || {};
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
