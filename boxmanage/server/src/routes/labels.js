const express = require('express');
const QRCode = require('qrcode');
const sharp = require('sharp');
const { db, getSetting } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// Generování štítku jedné krabice jako PNG.
// Zvolená cesta: "qrcode" (PNG buffer) + "sharp" (SVG kompozice s textem -> render do PNG).
// sharp se instaluje s prebuilt binárkami pro Windows i Docker image (alpine amd64/arm64)
// a umí rastrovat SVG s <text>, takže fallback (qrcode SVG + @resvg/resvg-js) nebyl potřeba.
router.get('/boxes/:id/label.png', requireAuth, async (req, res) => {
  const box = db.prepare('SELECT * FROM boxes WHERE id = ?').get(String(req.params.id));
  if (!box) return res.status(404).json({ error: 'Krabice nenalezena' });

  const width = Math.max(200, Math.min(800, Number(req.query.width) || 384));
  const pad = Math.round(width * 0.045);
  const qrSize = width - pad * 2;
  const nameFont = Math.round(width * 0.072);
  const posFont = Math.round(nameFont * 0.66);
  const nameLineH = Math.round(nameFont * 1.3);
  const gap = Math.round(nameFont * 0.35);

  try {
    const qrPng = await QRCode.toBuffer(box.id, {
      type: 'png', width: qrSize, margin: 2, errorCorrectionLevel: 'M',
    });

    const nameLines = getSetting('label_show_name', '1') === '1' ? wrap(box.name, qrSize, nameFont, 2) : [];
    const pos = getSetting('label_show_position', '1') === '1'
      ? (box.position ? truncate(String(box.position), qrSize, posFont) : '')
      : '';
    const textBlock = nameLines.length * nameLineH + (pos ? Math.round(posFont * 1.3) + nameLineH * 0.5 : 0);
    const height = pad + qrSize + (textBlock ? gap + textBlock : 0) + pad;

    const parts = [];
    parts.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);
    parts.push(`<image href="data:image/png;base64,${qrPng.toString('base64')}" x="${pad}" y="${pad}" width="${qrSize}" height="${qrSize}"/>`);

    let ty = pad + qrSize + gap;
    for (const line of nameLines) {
      parts.push(textEl(line, width, ty, nameFont, true));
      ty += nameLineH;
    }
    if (pos) {
      ty += nameLineH * 0.5;
      parts.push(textEl(pos, width, ty, posFont, false));
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${box.id}-label.png"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(png);
  } catch (err) {
    console.error('[labels] Chyba při generování štítku:', err);
    res.status(500).json({ error: 'Chyba při generování štítku' });
  }
});

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
