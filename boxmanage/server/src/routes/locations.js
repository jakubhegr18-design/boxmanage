const express = require('express');
const { db } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT l.*, (SELECT COUNT(*) FROM boxes b WHERE b.location_id = l.id) AS box_count
    FROM locations l
    ORDER BY l.name
  `).all();
  res.json(rows);
});

router.post('/', requireAuth, requireAdmin, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Název je povinný' });
  const existing = db.prepare('SELECT id FROM locations WHERE name = ?').get(name);
  if (existing) return res.status(409).json({ error: 'Lokace už existuje' });
  const r = db.prepare('INSERT INTO locations (name, description) VALUES (?, ?)')
    .run(name, String(req.body?.description || '').trim());
  res.status(201).json(db.prepare('SELECT * FROM locations WHERE id = ?').get(r.lastInsertRowid));
});

router.patch('/:id', requireAuth, requireAdmin, (req, res) => {
  const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
  if (!loc) return res.status(404).json({ error: 'Lokace nenalezena' });
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Název je povinný' });
  db.prepare('UPDATE locations SET name = ?, description = ? WHERE id = ?')
    .run(name, String(req.body?.description || '').trim(), loc.id);
  res.json(db.prepare('SELECT * FROM locations WHERE id = ?').get(loc.id));
});

router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
  if (!loc) return res.status(404).json({ error: 'Lokace nenalezena' });
  db.prepare('DELETE FROM locations WHERE id = ?').run(loc.id);
  res.json({ ok: true });
});

module.exports = router;
