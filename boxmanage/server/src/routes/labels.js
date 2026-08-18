const express = require('express');
const QRCode = require('qrcode');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const { db, jwtSecret, getSetting } = require('../db');

const router = express.Router();

// Auth z hlavičky (Bearer) nebo z query ?t= (kvůli <img>/Coil v mobilní aplikaci).
function requireAuthOrQuery(req, res, next) {
  let token = null;
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) token = header.slice(7);
  if (!token) token = String(req.query.t || '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function labelMetrics(width) {
  const w = Math.max(200, Math.min(800, Number(width) || 384));
  const pad = Math.round(w * 0.045);
  return {
    w,
    pad,
    qrSize: w - pad * 2,
    nameFont: Math.round(w * 0.072),
    posFont: Math.round(w * 0.072 * 0.66),
  };
}

// Společné vykreslení štítku (QR + řádky textu) do PNG.
async function renderLabel({ qrData, mainLines, extraLines, width, filename }, res) {
  const m = labelMetrics(width);
  const nameLineH = Math.round(m.nameFont * 1.3);
  const extraLineH = Math.round(m.posFont * 1.4);
  const gap = Math.round(m.nameFont * 0.35);

  const qrPng = await QRCode.toBuffer(qrData, {
    type: 'png', width: m.qrSize, margin: 2, errorCorrectionLevel: 'M',
  });

  const textBlock = mainLines.length * nameLineH + extraLines.length * extraLineH;
  const height = m.pad + m.qrSize + (textBlock ? gap + textBlock : 0) + m.pad;

  const parts = [];
  parts.push(`<rect width="${m.w}" height="${height}" fill="#ffffff"/>`);
  parts.push(`<image href="data:image/png;base64,${qrPng.toString('base64')}" x="${m.pad}" y="${m.pad}" width="${m.qrSize}" height="${m.qrSize}"/>`);

  let ty = m.pad + m.qrSize + gap;
  for (const line of mainLines) {
    parts.push(textEl(line, m.w, ty, m.nameFont, true));
    ty += nameLineH;
  }
  ty += nameLineH * 0.5;
  for (const line of extraLines) {
    parts.push(textEl(line, m.w, ty, m.posFont, false));
    ty += extraLineH;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${m.w}" height="${height}" viewBox="0 0 ${m.w} ${height}">${parts.join('')}</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(png);
}

// Štítek krabice — QR obsahuje raw ID krabice.
router.get('/boxes/:id/label.png', requireAuthOrQuery, async (req, res) => {
  try {
    const box = db.prepare('SELECT * FROM boxes WHERE id = ?').get(String(req.params.id));
    if (!box) return res.status(404).json({ error: 'Krabice nenalezena' });

    const m = labelMetrics(req.query.width);
    const mainLines = getSetting('label_show_name', '1') === '1' ? wrap(box.name, m.qrSize, m.nameFont, 2) : [];
    const extraLines = [];
    if (getSetting('label_show_position', '1') === '1' && box.position) {
      extraLines.push(truncate(String(box.position), m.qrSize, m.posFont));
    }

    await renderLabel({
      qrData: box.id,
      mainLines,
      extraLines,
      width: req.query.width,
      filename: `${box.id}-label.png`,
    }, res);
  } catch (err) {
    console.error('[labels] Chyba při generování štítku krabice:', err);
    res.status(500).json({ error: 'Chyba při generování štítku' });
  }
});

// Štítek položky — QR obsahuje bm://item?b=<box>&i=<item>.
router.get('/items/:id/label.png', requireAuthOrQuery, async (req, res) => {
  try {
    const item = db.prepare(`
      SELECT i.*, b.name AS box_name, b.position AS box_position
      FROM items i
      JOIN boxes b ON b.id = i.box_id
      WHERE i.id = ?
    `).get(Number(req.params.id));
    if (!item) return res.status(404).json({ error: 'Položka nenalezena' });

    const m = labelMetrics(req.query.width);
    const mainLines = getSetting('label_show_name', '1') === '1' ? wrap(item.name, m.qrSize, m.nameFont, 2) : [];
    const extraLines = [];
    if (getSetting('label_show_position', '1') === '1' && item.box_position) {
      extraLines.push(truncate(String(item.box_position), m.qrSize, m.posFont));
    }
    const qty = `${fmtQty(item.quantity)} ${item.unit || ''}`.trim();
    if (qty) extraLines.push(truncate(qty, m.qrSize, m.posFont));

    await renderLabel({
      qrData: `bm://item?b=${encodeURIComponent(item.box_id)}&i=${item.id}`,
      mainLines,
      extraLines,
      width: req.query.width,
      filename: `item-${item.id}-label.png`,
    }, res);
  } catch (err) {
    console.error('[labels] Chyba při generování štítku položky:', err);
    res.status(500).json({ error: 'Chyba při generování štítku' });
  }
});

// Štítek lokace — QR obsahuje bm://location?l=<id> (skener otevře krabice lokace).
router.get('/locations/:id/label.png', requireAuthOrQuery, async (req, res) => {
  try {
    const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(Number(req.params.id));
    if (!loc) return res.status(404).json({ error: 'Lokace nenalezena' });

    const m = labelMetrics(req.query.width);
    const mainLines = getSetting('label_show_name', '1') === '1' ? wrap(loc.name, m.qrSize, m.nameFont, 2) : [];
    const extraLines = [];
    if (loc.description) extraLines.push(truncate(String(loc.description), m.qrSize, m.posFont));

    await renderLabel({
      qrData: `bm://location?l=${loc.id}`,
      mainLines,
      extraLines,
      width: req.query.width,
      filename: `location-${loc.id}-label.png`,
    }, res);
  } catch (err) {
    console.error('[labels] Chyba při generování štítku lokace:', err);
    res.status(500).json({ error: 'Chyba při generování štítku' });
  }
});

function fmtQty(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return (Math.round(v * 100) / 100).toString();
}

function textEl(text, width, y, fontSize, bold) {
  return `<text x="${width / 2}" y="${y}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="${bold ? 'bold' : 'normal'}" fill="#000000">${escapeXml(text)}</text>`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function maxChars(maxWidth, fontSize) {
  return Math.max(1, Math.floor(maxWidth / (fontSize * 0.6)));
}

function truncate(text, maxWidth, fontSize) {
  const n = maxChars(maxWidth, fontSize);
  return text.length > n ? text.slice(0, Math.max(1, n - 1)) + '…' : text;
}

function wrap(text, maxWidth, fontSize, maxLines) {
  const n = maxChars(maxWidth, fontSize);
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length <= n) {
      cur = candidate;
    } else if (cur) {
      lines.push(cur);
      cur = w;
    } else {
      lines.push(candidate.slice(0, n));
      cur = '';
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = truncate(lines[maxLines - 1], maxWidth, fontSize);
  }
  return lines;
}

module.exports = router;
