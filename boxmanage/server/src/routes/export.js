const express = require('express');
const ExcelJS = require('exceljs');
const { db } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

function boxRows() {
  return db.prepare(`
    SELECT b.id, b.name, b.description, b.position,
           CASE b.section WHEN 'drawer' THEN 'šuplík' WHEN 'shelf' THEN 'polička' WHEN 'cabinet' THEN 'skříň' ELSE '' END AS section,
           COALESCE(l.name, '') AS location_name,
           COALESCE(d.name, '') AS drawer_name,
           b.created_at, b.updated_at
    FROM boxes b
    LEFT JOIN locations l ON l.id = b.location_id
    LEFT JOIN drawers d ON d.id = b.drawer_id
    ORDER BY b.name
  `).all();
}

function itemRows() {
  return db.prepare(`
    SELECT b.id AS box_id, b.name AS box_name, b.position,
           COALESCE(l.name, '') AS location_name,
           COALESCE(d.name, '') AS drawer_name,
           i.name AS item_name, i.quantity, i.unit
    FROM items i
    JOIN boxes b ON b.id = i.box_id
    LEFT JOIN locations l ON l.id = b.location_id
    LEFT JOIN drawers d ON d.id = b.drawer_id
    ORDER BY b.name, i.name
  `).all();
}

router.get('/csv', requireAuth, (req, res) => {
  const rows = itemRows();
  const lines = [
    ['krabice_id', 'krabice', 'pozice', 'lokace', 'šuplík', 'položka', 'množství', 'jednotka'],
    ...rows.map((r) => [r.box_id, r.box_name, r.position, r.location_name, r.drawer_name, r.item_name, r.quantity, r.unit]),
  ];
  const csv = '\uFEFF' + lines.map((l) => l.map(esc).join(';')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="boxmanage-export.csv"');
  res.send(csv);
});

router.get('/xlsx', requireAuth, async (req, res) => {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const wsBoxes = wb.addWorksheet('Krabice');
  wsBoxes.columns = [
    { header: 'ID', key: 'id', width: 40 },
    { header: 'Název', key: 'name', width: 30 },
    { header: 'Popis', key: 'description', width: 40 },
    { header: 'Pozice', key: 'position', width: 10 },
    { header: 'Sekce', key: 'section', width: 10 },
    { header: 'Lokace', key: 'location_name', width: 20 },
    { header: 'Šuplík', key: 'drawer_name', width: 15 },
    { header: 'Vytvořeno', key: 'created_at', width: 20 },
    { header: 'Upraveno', key: 'updated_at', width: 20 },
  ];
  wsBoxes.addRows(boxRows());

  const wsItems = wb.addWorksheet('Položky');
  wsItems.columns = [
    { header: 'ID krabice', key: 'box_id', width: 40 },
    { header: 'Krabice', key: 'box_name', width: 30 },
    { header: 'Pozice', key: 'position', width: 10 },
    { header: 'Lokace', key: 'location_name', width: 20 },
    { header: 'Šuplík', key: 'drawer_name', width: 15 },
    { header: 'Položka', key: 'item_name', width: 30 },
    { header: 'Množství', key: 'quantity', width: 12 },
    { header: 'Jednotka', key: 'unit', width: 10 },
  ];
  wsItems.addRows(itemRows());

  const wsMov = wb.addWorksheet('Historie');
  wsMov.columns = [
    { header: 'Čas', key: 'created_at', width: 22 },
    { header: 'Krabice', key: 'box_name', width: 30 },
    { header: 'Akce', key: 'action', width: 24 },
    { header: 'Uživatel', key: 'username', width: 16 },
    { header: 'Detail', key: 'detail', width: 60 },
  ];
  wsMov.addRows(db.prepare(`
    SELECT m.created_at, b.name AS box_name, m.action, u.username, m.detail
    FROM movements m
    LEFT JOIN boxes b ON b.id = m.box_id
    LEFT JOIN users u ON u.id = m.user_id
    ORDER BY m.created_at DESC
  `).all().map((m) => ({ ...m, detail: fmtDetail(m.action, m.detail) })));

  for (const ws of [wsBoxes, wsItems, wsMov]) {
    ws.getRow(1).font = { bold: true };
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="boxmanage-export.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

function esc(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function fmtQty(n) {
  const num = Number(n);
  if (!isFinite(num)) return '';
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '');
}

// Plná záloha celé databáze v JSON (kromě citlivých nastavení) — pro případ obnovy.
const SENSITIVE_SETTINGS = new Set(['jwt_secret', 'telegram_token', 'vapid_private_key']);
router.get('/json', requireAuth, (req, res) => {
  const dump = {
    exported_at: new Date().toISOString(),
    app: 'boxmanage',
    version: 1,
    users: db.prepare('SELECT id, username, role, created_at FROM users').all(),
    locations: db.prepare('SELECT * FROM locations').all(),
    drawers: db.prepare('SELECT * FROM drawers').all(),
    boxes: db.prepare('SELECT * FROM boxes').all(),
    items: db.prepare('SELECT * FROM items').all(),
    movements: db.prepare('SELECT * FROM movements').all(),
    box_photos: db.prepare('SELECT * FROM box_photos').all(),
    item_photos: db.prepare('SELECT * FROM item_photos').all(),
    remote_sessions: db.prepare('SELECT * FROM remote_sessions').all(),
    remote_events: db.prepare('SELECT * FROM remote_events').all(),
    settings: db.prepare('SELECT key, value FROM settings').all().filter((s) => !SENSITIVE_SETTINGS.has(s.key)),
  };
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="boxmanage-backup-${date}.json"`);
  res.send(JSON.stringify(dump, null, 2));
});

// Z objektu detail + action vytvoří čitelný text (obdoba fmtMovement/fmtDetail na frontendu),
// aby ExcelJS nemusel do buňky ukládat syrový objekt.
function fmtDetail(action, rawDetail) {
  let d = {};
  if (rawDetail) {
    try { d = typeof rawDetail === 'string' ? JSON.parse(rawDetail) : rawDetail; } catch { d = {}; }
  }
  switch (action) {
    case 'quantity_added': return `${d.item || ''} +${fmtQty(d.quantity)} ${d.unit || ''}`.trim();
    case 'quantity_removed': return `${d.item || ''} −${fmtQty(d.quantity)} ${d.unit || ''}`.trim();
    case 'item_added': return `${d.item || ''} (${fmtQty(d.quantity)} ${d.unit || ''})`.trim();
    case 'item_updated':
    case 'item_deleted': return d.item || '';
    case 'position_changed': return `${d.from || '—'} → ${d.to || '—'}`;
    case 'moved': return `${d.from || '—'} → ${d.to || '—'}`;
    case 'created': return d.position ? `pozice ${d.position}` : '';
    case 'updated': return Array.isArray(d.changes) ? d.changes.join(', ') : '';
    case 'deleted': return d.name || '';
    case 'scanned': return '';
    default: return '';
  }
}

module.exports = router;
