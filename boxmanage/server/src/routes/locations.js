const express = require('express');
const { db } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { blinkLight, haAvailable } = require('../ha');

const router = express.Router();

const LOCATION_TYPES = { '': '', 'skříň': 'skříň' };
function normalizeType(v) {
  return LOCATION_TYPES[String(v || '').trim().toLowerCase()] ?? '';
}

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT l.*, (SELECT COUNT(*) FROM boxes b WHERE b.location_id = l.id) AS box_count,
      (SELECT COUNT(*) FROM drawers d WHERE d.location_id = l.id) AS drawer_count
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
  const r = db.prepare('INSERT INTO locations (name, description, type, light_entity, light_on_scan) VALUES (?, ?, ?, ?, ?)')
    .run(name, String(req.body?.description || '').trim(),
      normalizeType(req.body?.type),
      String(req.body?.lightEntity || '').trim(),
      req.body?.lightOnScan ? 1 : 0);
  res.status(201).json(db.prepare('SELECT * FROM locations WHERE id = ?').get(r.lastInsertRowid));
});

router.patch('/:id', requireAuth, requireAdmin, (req, res) => {
  const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
  if (!loc) return res.status(404).json({ error: 'Lokace nenalezena' });
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Název je povinný' });
  db.prepare('UPDATE locations SET name = ?, description = ?, type = ?, light_entity = ?, light_on_scan = ? WHERE id = ?')
    .run(name, String(req.body?.description || '').trim(),
      normalizeType(req.body?.type),
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

// ── Drawers (šuplíky) ────────────────────────────────────────────

router.get('/:id/drawers', requireAuth, (req, res) => {
  const loc = db.prepare('SELECT id FROM locations WHERE id = ?').get(req.params.id);
  if (!loc) return res.status(404).json({ error: 'Lokace nenalezena' });
  const rows = db.prepare(`
    SELECT d.*, (SELECT COUNT(*) FROM boxes b WHERE b.drawer_id = d.id) AS box_count
    FROM drawers d
    WHERE d.location_id = ?
    ORDER BY d.position, d.name
  `).all(loc.id);
  res.json(rows);
});

router.post('/:id/drawers', requireAuth, requireAdmin, (req, res) => {
  const loc = db.prepare('SELECT id FROM locations WHERE id = ?').get(req.params.id);
  if (!loc) return res.status(404).json({ error: 'Lokace nenalezena' });
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Název šuplíku je povinný' });
  const existing = db.prepare('SELECT id FROM drawers WHERE location_id = ? AND name = ?').get(loc.id, name);
  if (existing) return res.status(409).json({ error: 'Šuplík s tímto názvem už v lokaci existuje' });
  const maxPos = db.prepare('SELECT MAX(position) AS m FROM drawers WHERE location_id = ?').get(loc.id);
  const r = db.prepare('INSERT INTO drawers (location_id, name, position) VALUES (?, ?, ?)')
    .run(loc.id, name, (maxPos?.m ?? -1) + 1);
  res.status(201).json(db.prepare('SELECT * FROM drawers WHERE id = ?').get(r.lastInsertRowid));
});

router.patch('/:locationId/drawers/:drawerId', requireAuth, requireAdmin, (req, res) => {
  const loc = db.prepare('SELECT id FROM locations WHERE id = ?').get(req.params.locationId);
  if (!loc) return res.status(404).json({ error: 'Lokace nenalezena' });
  const drawer = db.prepare('SELECT * FROM drawers WHERE id = ? AND location_id = ?').get(req.params.drawerId, loc.id);
  if (!drawer) return res.status(404).json({ error: 'Šuplík nenalezen' });
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Název šuplíku je povinný' });
  const dup = db.prepare('SELECT id FROM drawers WHERE location_id = ? AND name = ? AND id != ?').get(loc.id, name, drawer.id);
  if (dup) return res.status(409).json({ error: 'Šuplík s tímto názvem už v lokaci existuje' });
  db.prepare('UPDATE drawers SET name = ? WHERE id = ?').run(name, drawer.id);
  res.json(db.prepare('SELECT * FROM drawers WHERE id = ?').get(drawer.id));
});

router.delete('/:locationId/drawers/:drawerId', requireAuth, requireAdmin, (req, res) => {
  const loc = db.prepare('SELECT id FROM locations WHERE id = ?').get(req.params.locationId);
  if (!loc) return res.status(404).json({ error: 'Lokace nenalezena' });
  const drawer = db.prepare('SELECT * FROM drawers WHERE id = ? AND location_id = ?').get(req.params.drawerId, loc.id);
  if (!drawer) return res.status(404).json({ error: 'Šuplík nenalezen' });
  db.prepare('UPDATE boxes SET drawer_id = NULL WHERE drawer_id = ?').run(drawer.id);
  db.prepare('DELETE FROM drawers WHERE id = ?').run(drawer.id);
  res.json({ ok: true });
});

module.exports = router;
