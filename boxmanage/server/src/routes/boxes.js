const express = require('express');
const crypto = require('node:crypto');
const { db, touchBox, logMovement } = require('../db');
const { requireAuth } = require('../auth');
const { actionLabel } = require('../action-labels');
const { blinkLight, turnOnLight, haAvailable } = require('../ha');
const { recordRemoteScan } = require('./remote');
const { notifyWebhooks } = require('../webhooks');
const { notifyPush } = require('../push');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  const locationId = req.query.location ? Number(req.query.location) : null;
  const drawerId = req.query.drawer ? Number(req.query.drawer) : null;
  const position = String(req.query.position || '').trim().toLowerCase();
  const section = normalizeSection(req.query.section);
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
  if (drawerId) {
    where.push('b.drawer_id = ?');
    params.push(drawerId);
  }
  if (position) {
    where.push('LOWER(b.position) = ?');
    params.push(position);
  }
  if (section) {
    where.push('b.section = ?');
    params.push(section);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM boxes b ${whereSql}`).get(...params).c;

  const items = db.prepare(`
    SELECT b.*, l.name AS location_name, p.name AS parent_name, d.name AS drawer_name,
      (SELECT COUNT(*) FROM items i WHERE i.box_id = b.id) AS item_count,
      (SELECT filename FROM box_photos bp WHERE bp.box_id = b.id ORDER BY bp.created_at DESC LIMIT 1) AS photo
    FROM boxes b
    LEFT JOIN locations l ON l.id = b.location_id
    LEFT JOIN boxes p ON p.id = b.parent_id
    LEFT JOIN drawers d ON d.id = b.drawer_id
    ${whereSql}
    ORDER BY b.updated_at DESC, b.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

// ── Drawers endpoint for box assignment (must be before /:id) ───
router.get('/drawers/:locationId', requireAuth, (req, res) => {
  const loc = db.prepare('SELECT id FROM locations WHERE id = ?').get(Number(req.params.locationId));
  if (!loc) return res.status(404).json({ error: 'Lokace nenalezena' });
  const rows = db.prepare('SELECT * FROM drawers WHERE location_id = ? ORDER BY position, name').all(loc.id);
  res.json(rows);
});

router.get('/:id', requireAuth, (req, res) => {
  const box = getBox(req.params.id);
  if (!box) return res.status(404).json({ error: 'Krabice nenalezena' });
  box.items = db.prepare('SELECT * FROM items WHERE box_id = ? ORDER BY name').all(box.id);

  // Fotky krabice a fotky jednotlivých položek.
  box.photos = db.prepare('SELECT * FROM box_photos WHERE box_id = ? ORDER BY created_at DESC').all(box.id);
  const itemPhotos = db.prepare(`
    SELECT ip.* FROM item_photos ip
    JOIN items i ON i.id = ip.item_id
    WHERE i.box_id = ?
    ORDER BY ip.created_at DESC
  `).all(box.id);
  const photosByItem = new Map();
  for (const p of itemPhotos) {
    const list = photosByItem.get(p.item_id) || [];
    list.push(p);
    photosByItem.set(p.item_id, list);
  }
  box.items = box.items.map((it) => ({ ...it, photos: photosByItem.get(it.id) || [] }));

  box.movements = db.prepare(`
    SELECT m.*, u.username
    FROM movements m
    LEFT JOIN users u ON u.id = m.user_id
    WHERE m.box_id = ?
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 50
  `).all(box.id).map((m) => ({ ...m, action_label: actionLabel(m.action) }));
  box.children = childrenOf(box.id);
  res.json(box);
});

router.post('/', requireAuth, (req, res) => {
  const { name, description, position, locationId, id, parentId, section, drawerId } = req.body || {};
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

  // Vnoření do jiné krabice (krabice ve krabici).
  let parent = null;
  if (parentId !== undefined && parentId !== null && String(parentId).trim() !== '') {
    const pid = String(parentId).trim();
    if (pid === boxId) return res.status(400).json({ error: 'Krabice nemůže být uvnitř sebe sama' });
    parent = db.prepare('SELECT id, name FROM boxes WHERE id = ?').get(pid);
    if (!parent) return res.status(404).json({ error: 'Nadřazená krabice neexistuje' });
  }

  const pos = String(position || '').trim().toUpperCase();
  const drawerIdVal = drawerId ? Number(drawerId) : null;
  if (drawerIdVal) {
    const drawer = db.prepare('SELECT id FROM drawers WHERE id = ?').get(drawerIdVal);
    if (!drawer) return res.status(404).json({ error: 'Šuplík nenalezen' });
  }
  db.prepare(`
    INSERT INTO boxes (id, name, description, position, location_id, parent_id, drawer_id, section, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(boxId, String(name).trim(), String(description || '').trim(), pos,
    locationId ? Number(locationId) : null, parent?.id || null, drawerIdVal, normalizeSection(section), req.user.id);
  logMovement(boxId, req.user.id, 'created', { name: String(name).trim(), position: pos, location_id: locationId || null, parent_id: parent?.id || null, drawer_id: drawerIdVal || null });
  res.status(201).json(getBox(boxId));
});

router.patch('/:id', requireAuth, (req, res) => {
  const box = getBox(req.params.id);
  if (!box) return res.status(404).json({ error: 'Krabice nenalezena' });
  const { name, description, position, locationId, parentId, section, drawerId } = req.body || {};
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
  if (section !== undefined) {
    const sec = normalizeSection(section);
    updates.push('section = ?'); params.push(sec);
    if (sec !== box.section) changes.push(`sekce: ${sectionLabel(box.section)} → ${sectionLabel(sec)}`);
  }
  if (locationId !== undefined) {
    const loc = locationId ? Number(locationId) : null;
    updates.push('location_id = ?'); params.push(loc);
    const oldName = box.location_name || '—';
    const newName = loc ? (db.prepare('SELECT name FROM locations WHERE id = ?').get(loc)?.name || '?') : '—';
    changes.push(`lokace: ${oldName} → ${newName}`);
  }
  if (parentId !== undefined) {
    const newParent = parentId ? String(parentId).trim() : null;
    if (newParent === box.id) return res.status(400).json({ error: 'Krabice nemůže být uvnitř sebe sama' });
    let newParentName = '—';
    if (newParent) {
      const p = db.prepare('SELECT id, name FROM boxes WHERE id = ?').get(newParent);
      if (!p) return res.status(404).json({ error: 'Nadřazená krabice neexistuje' });
      if (isDescendant(box.id, newParent)) {
        return res.status(400).json({ error: 'Krabice nemůže být vnořená do své vlastní vnořené krabice' });
      }
      newParentName = p.name;
    }
    updates.push('parent_id = ?'); params.push(newParent);
    changes.push(`nadřazená krabice: ${box.parent_name || '—'} → ${newParentName}`);
  }
  if (drawerId !== undefined) {
    const newDrawerId = drawerId ? Number(drawerId) : null;
    if (newDrawerId) {
      const dr = db.prepare('SELECT id, name FROM drawers WHERE id = ?').get(newDrawerId);
      if (!dr) return res.status(404).json({ error: 'Šuplík nenalezen' });
      if (box.drawer_id !== newDrawerId) changes.push(`šuplík: ${box.drawer_name || '—'} → ${dr.name}`);
    } else if (box.drawer_id) {
      changes.push(`šuplík: ${box.drawer_name || '—'} → —`);
    }
    updates.push('drawer_id = ?'); params.push(newDrawerId);
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
    fireEvents('position_changed', box, req.user.id);
  }
  res.json(getBox(box.id));
});

router.post('/:id/move', requireAuth, (req, res) => {
  const box = getBox(req.params.id);
  if (!box) return res.status(404).json({ error: 'Krabice nenalezena' });
  const loc = req.body?.locationId ? Number(req.body.locationId) : null;
  const drawer = req.body?.drawerId ? Number(req.body.drawerId) : null;
  const oldName = box.location_name || '—';
  const newName = loc ? (db.prepare('SELECT name FROM locations WHERE id = ?').get(loc)?.name || '?') : '—';
  db.prepare('UPDATE boxes SET location_id = ?, drawer_id = ?, updated_at = datetime(\'now\') WHERE id = ?').run(loc, drawer, box.id);
  logMovement(box.id, req.user.id, 'moved', { from: oldName, to: newName });
  fireEvents('moved', box, req.user.id);
  res.json(getBox(box.id));
});

// Přesun krabice do jiné krabice (nebo vyndání na úroveň, když je parentId null).
router.post('/:id/into', requireAuth, (req, res) => {
  const box = getBox(req.params.id);
  if (!box) return res.status(404).json({ error: 'Krabice nenalezena' });
  const parentId = req.body?.parentId ? String(req.body.parentId).trim() : null;
  if (parentId === box.id) return res.status(400).json({ error: 'Krabice nemůže být uvnitř sebe sama' });
  let newParentName = '—';
  if (parentId) {
    const p = db.prepare('SELECT id, name FROM boxes WHERE id = ?').get(parentId);
    if (!p) return res.status(404).json({ error: 'Nadřazená krabice neexistuje' });
    if (isDescendant(box.id, parentId)) {
      return res.status(400).json({ error: 'Krabice nemůže být vnořená do své vlastní vnořené krabice' });
    }
    newParentName = p.name;
  }
  const oldParentName = box.parent_name || '—';
  db.prepare('UPDATE boxes SET parent_id = ?, updated_at = datetime(\'now\') WHERE id = ?').run(parentId, box.id);
  logMovement(box.id, req.user.id, 'moved', { into: newParentName, from: oldParentName });
  fireEvents('into', box, req.user.id);
  res.json(getBox(box.id));
});

// Záznam naskenování krabice z mobilu (dálkový skener) — zobrazí se na PC živě.
router.post('/:id/scan', requireAuth, (req, res) => {
  const box = getBox(req.params.id);
  if (!box) return res.status(404).json({ error: 'Krabice nenalezena' });
  logMovement(box.id, req.user.id, 'scanned', {});

  // Udalost ven (webhooky) — např. do Home Assistant/Node-RED.
  fireEvents('scan', box, req.user.id);

  // Pokud mobil skenuje v dálkovém režimu, zapíše se událost do fronty skeneru
  // a PC ji obdrží živě přes SSE.
  const sessionToken = String(req.body?.session || '').trim();
  if (sessionToken) {
    recordRemoteScan({ boxId: box.id, userId: req.user.id, sessionToken });
  }

  // Automatické rozsvícení světla lokace při naskenování (pokud je povolené).
  // Lokace se dědí z nadřazených krabic (krabice ve krabici).
  const locId = resolveLocationId(box);
  if (locId) {
    const loc = db.prepare('SELECT light_entity, light_on_scan FROM locations WHERE id = ?').get(locId);
    if (loc?.light_entity && Number(loc.light_on_scan) === 1 && haAvailable()) {
      turnOnLight(loc.light_entity).catch((err) => console.error('[boxmanage] Rozsvícení světla při skenu selhalo:', err.message));
    }
  }

  res.json({ ok: true });
});

// Zabliká světlem lokace krabice, aby se dalo najít, kde krabice je.
router.post('/:id/find', requireAuth, async (req, res) => {
  try {
    const box = getBox(req.params.id);
    if (!box) return res.status(404).json({ error: 'Krabice nenalezena' });
    const locId = resolveLocationId(box);
    if (!locId) return res.status(400).json({ error: 'Krabice nemá přiřazenou lokaci' });
    const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(locId);
    if (!loc?.light_entity) {
      return res.status(400).json({ error: `Lokace „${loc?.name || '?'}“ nemá přiřazené světlo (nastav ho v Lokace)` });
    }
    if (!haAvailable()) {
      return res.status(503).json({ error: 'Home Assistant není dostupný (server běží mimo HA add-on).' });
    }
    await blinkLight(loc.light_entity);
    res.json({ ok: true, entity: loc.light_entity, location: loc.name });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Blikání světla selhalo' });
  }
});

// Udalosti ven (best-effort): webhooky pro všechny pohyby/sken, push notifikace
// pro přesuny krabic (server → telefon). Chyby se jen logují, operaci neruší.
function fireEvents(event, box, userId) {
  const base = {
    event,
    at: new Date().toISOString(),
    box: box
      ? { id: box.id, name: box.name, position: box.position, location_name: box.location_name }
      : null,
    user_id: userId,
  };
  notifyWebhooks(base).catch((err) => console.error('[webhook] selhal:', err.message));
  if (event === 'moved' || event === 'into' || event === 'position_changed') {
    notifyPush({ title: 'Krabice přesunuta', body: box?.name || 'Krabice', url: `/boxes/${box?.id || ''}` })
      .catch((err) => console.error('[push] selhal:', err.message));
  }
}

function getBox(id) {
  const box = db.prepare(`
    SELECT b.*, l.name AS location_name, p.name AS parent_name, d.name AS drawer_name
    FROM boxes b
    LEFT JOIN locations l ON l.id = b.location_id
    LEFT JOIN boxes p ON p.id = b.parent_id
    LEFT JOIN drawers d ON d.id = b.drawer_id
    WHERE b.id = ?
  `).get(String(id));
  if (box) {
    box.location_name = box.location_name || '';
    box.parent_name = box.parent_name || '';
    box.drawer_name = box.drawer_name || '';
  }
  return box;
}

// Vnořené krabice (krabice ve krabici) pro detail.
function childrenOf(boxId) {
  return db.prepare(`
    SELECT c.id, c.name, c.position, c.parent_id,
      (SELECT COUNT(*) FROM items i WHERE i.box_id = c.id) AS item_count,
      (SELECT filename FROM box_photos bp WHERE bp.box_id = c.id ORDER BY bp.created_at DESC LIMIT 1) AS photo
    FROM boxes c
    WHERE c.parent_id = ?
    ORDER BY c.name
  `).all(boxId);
}

// Je kandidát (parentId) vnořený uvnitř podstromu boxId? (ochrana proti cyklům)
function isDescendant(boxId, parentId) {
  let cur = parentId;
  const seen = new Set();
  while (cur) {
    if (cur === boxId) return true;
    if (seen.has(cur)) break;
    seen.add(cur);
    const row = db.prepare('SELECT parent_id FROM boxes WHERE id = ?').get(cur);
    cur = row?.parent_id || null;
  }
  return false;
}

// Efektivní lokace: vlastní, jinak děděná z nejbližšího předka.
function resolveLocationId(box) {
  let cur = box;
  const seen = new Set();
  while (cur) {
    if (cur.location_id) return cur.location_id;
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    cur = cur.parent_id ? db.prepare('SELECT * FROM boxes WHERE id = ?').get(cur.parent_id) : null;
  }
  return null;
}

// Sekce (umístění krabice): šuplík / polička / skříň. Jen hodnoty z povoleného seznamu.
const SECTION_VALUES = { drawer: 'drawer', shelf: 'shelf', cabinet: 'cabinet' };
function normalizeSection(v) {
  return SECTION_VALUES[String(v || '').trim().toLowerCase()] || '';
}
function sectionLabel(v) {
  const labels = { drawer: 'šuplík', shelf: 'polička', cabinet: 'skříň' };
  return labels[String(v || '')] || 'bez sekce';
}

module.exports = router;
