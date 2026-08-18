const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../auth');
const { actionLabel } = require('../action-labels');

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
    action_label: actionLabel(m.action),
    detail: m.detail ? JSON.parse(m.detail) : {},
  }));

  const byPosition = db.prepare(`
    SELECT position, COUNT(*) AS c FROM boxes
    WHERE position != ''
    GROUP BY position ORDER BY c DESC, position
  `).all();

  // Pohyby za posledních 12 měsíců (vč. aktuálního) — pro graf na stránce Statistiky.
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', created_at) AS ym, COUNT(*) AS c
    FROM movements
    WHERE created_at >= datetime('now', 'start of month', '-11 months')
    GROUP BY ym ORDER BY ym
  `).all();

  // Počet krabic podle sekce (šuplík / polička / skříň).
  const bySection = db.prepare(`
    SELECT section, COUNT(*) AS c FROM boxes
    WHERE section != ''
    GROUP BY section ORDER BY c DESC
  `).all();

  // Nejvytíženější lokace podle počtu krabic.
  const topLocations = db.prepare(`
    SELECT l.id, l.name, COUNT(b.id) AS c
    FROM locations l
    LEFT JOIN boxes b ON b.location_id = l.id
    GROUP BY l.id ORDER BY c DESC, l.name
    LIMIT 10
  `).all();

  const movements = db.prepare('SELECT COUNT(*) AS c FROM movements').get().c;

  res.json({ boxes, locations, users, items, itemTotal, movements, recent, byPosition, monthly, topLocations, bySection });
});

module.exports = router;
