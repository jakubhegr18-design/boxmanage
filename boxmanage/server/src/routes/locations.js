const express = require('express');
const { db } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { blinkLight, haAvailable } = require('../ha');

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
  const r = db.prepare('INSERT INTO locations (name, description, light_entity, light_on_scan) VALUES (?, ?, ?, ?)')
    .run(name, String(req.body?.description || '').trim(),
      String(req.body?.lightEntity || '').trim(),
      req.body?.lightOnScan ? 1 : 0);
  res.status(201).json(db.prepare('SELECT * FROM locations WHERE id = ?').get(r.lastInsertRowid));
});

router.patch('/:id', requireAuth, requireAdmin, (req, res) => {
  const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
  if (!loc) return res.status(404).json({ error: 'Lokace nenalezena' });
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Název je povinný' });
  db.prepare('UPDATE locations SET name = ?, description = ?, light_entity = ?, light_on_scan = ? WHERE id = ?')
    .run(name, String(req.body?.description || '').trim(),
      String(req.body?.lightEntity || '').trim(),
      req.body?.lightOnScan ? 1 : 0, loc.id);
  res.json(db.prepare('SELECT * FROM locations WHERE id = ?').get(loc.id));
});

// Test blikání světla lokace (tlačítko v editaci lokace).
router.post('/:id/find', requireAuth, async (req, res) => {
  try {
    const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
    if (!loc) return res.status(404).json({ error: 'Lokace nenalezena' });
    if (!loc.light_entity) return res.status(400).json({ error: 'Lokace nemá přiřazené světlo' });
    if (!haAvailable()) return res.status(503).json({ error: 'Home Assistant není dostupný (server běží mimo HA add-on).' });
    await blinkLight(loc.light_entity);
    res.json({ ok: true, entity: loc.light_entity, location: loc.name });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Blikání světla selhalo' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
  if (!loc) return res.status(404).json({ error: 'Lokace nenalezena' });
  db.prepare('DELETE FROM locations WHERE id = ?').run(loc.id);
  res.json({ ok: true });
});

module.exports = router;
