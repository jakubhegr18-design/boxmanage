const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const boxes = db.prepare('SELECT COUNT(*) AS c FROM boxes').get().c;
  const locations = db.prepare('SELECT COUNT(*) AS c FROM locations').get().c;
  const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const items = db.prepare('SELECT COUNT(*) AS c FROM items').get().c;
  const itemTotal = db.prepare('SELECT COALESCE(SUM(quantity), 0) AS s FROM items').get().s;

  const recent = db.prepare(`
    SELECT m.*, u.username, b.name AS box_name
    FROM movements m
    LEFT JOIN users u ON u.id = m.user_id
    LEFT JOIN boxes b ON b.id = m.box_id
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 15
  `).all().map((m) => ({
    ...m,
    action_label: label(m.action),
    detail: m.detail ? JSON.parse(m.detail) : {},
  }));

  const byPosition = db.prepare(`
    SELECT position, COUNT(*) AS c FROM boxes
    WHERE position != ''
    GROUP BY position ORDER BY c DESC, position
  `).all();

  res.json({ boxes, locations, users, items, itemTotal, recent, byPosition });
});

function label(action) {
  return {
    created: 'Vytvořena',
    updated: 'Upravena',
    deleted: 'Smazána',
    moved: 'Přesunuta',
    position_changed: 'Změna pozice',
    item_added: 'Přidána položka',
    item_updated: 'Upravena položka',
    item_deleted: 'Smazána položka',
    quantity_added: 'Přidáno',
    quantity_removed: 'Vydáno',
  }[action] || action;
}

module.exports = router;
