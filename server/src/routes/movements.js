const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

const ACTIONS = {
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
};

router.get('/', requireAuth, (req, res) => {
  const boxId = req.query.box_id ? String(req.query.box_id) : null;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];
  if (boxId) {
    where.push('m.box_id = ?');
    params.push(boxId);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS c FROM movements m ${whereSql}`).get(...params).c;
  const rows = db.prepare(`
    SELECT m.*, u.username, b.name AS box_name
    FROM movements m
    LEFT JOIN users u ON u.id = m.user_id
    LEFT JOIN boxes b ON b.id = m.box_id
    ${whereSql}
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset).map((m) => ({
    ...m,
    action_label: ACTIONS[m.action] || m.action,
    detail: m.detail ? JSON.parse(m.detail) : {},
  }));

  res.json({ items: rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

module.exports = router;
