const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const { db, jwtSecret, dataDir, touchBox } = require('../db');
const { requireAuth } = require('../auth');

const photosDir = path.join(dataDir, 'photos');
fs.mkdirSync(photosDir, { recursive: true });

const router = express.Router();

// Převod libovolného ID z DB (krabice i položky) na číslo/text pro výpis.
function thumbName(filename) {
  const ext = path.extname(filename);
  return `${filename.slice(0, -ext.length)}-thumb.jpg`;
}

async function makeThumb(filename) {
  try {
    await sharp(path.join(photosDir, filename))
      .rotate()
      .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(path.join(photosDir, thumbName(filename)));
  } catch (err) {
    console.error('[boxmanage] Nepodařilo se vytvořit náhled fotky:', err.message);
  }
}

function removePhotoFiles(filename) {
  for (const f of [filename, thumbName(filename)]) {
    try { fs.unlinkSync(path.join(photosDir, f)); } catch { /* ignore */ }
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, photosDir),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname || '').toLowerCase() || '.jpg').slice(0, 8);
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Nahrát lze jen obrázky (JPEG/PNG/…)'));
  },
});

function photoRow(id) {
  return db.prepare('SELECT * FROM box_photos WHERE id = ?').get(id);
}

// Fotky krabice
router.post('/boxes/:id/photos', requireAuth, upload.array('photos', 10), (req, res) => {
  const box = db.prepare('SELECT id FROM boxes WHERE id = ?').get(req.params.id);
  if (!box) return res.status(404).json({ error: 'Krabice nenalezena' });
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'Nebyl vybrán žádný obrázek' });
  const created = [];
  for (const f of files) {
    makeThumb(f.filename);
    const r = db.prepare('INSERT INTO box_photos (box_id, filename, caption) VALUES (?, ?, ?)')
      .run(box.id, f.filename, String(req.body?.caption || '').trim());
    created.push(photoRow(r.lastInsertRowid));
  }
  touchBox(box.id);
  res.status(201).json({ photos: created });
});

router.delete('/box-photos/:id', requireAuth, (req, res) => {
  const ph = db.prepare('SELECT * FROM box_photos WHERE id = ?').get(req.params.id);
  if (!ph) return res.status(404).json({ error: 'Fotka nenalezena' });
  db.prepare('DELETE FROM box_photos WHERE id = ?').run(ph.id);
  removePhotoFiles(ph.filename);
  res.json({ ok: true });
});

// Fotky položek
router.post('/items/:id/photos', requireAuth, upload.array('photos', 10), (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Položka nenalezena' });
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'Nebyl vybrán žádný obrázek' });
  const created = [];
  for (const f of files) {
    makeThumb(f.filename);
    const r = db.prepare('INSERT INTO item_photos (item_id, filename, caption) VALUES (?, ?, ?)')
      .run(item.id, f.filename, String(req.body?.caption || '').trim());
    created.push(db.prepare('SELECT * FROM item_photos WHERE id = ?').get(r.lastInsertRowid));
  }
  touchBox(item.box_id);
  res.status(201).json({ photos: created });
});

router.delete('/item-photos/:id', requireAuth, (req, res) => {
  const ph = db.prepare('SELECT * FROM item_photos WHERE id = ?').get(req.params.id);
  if (!ph) return res.status(404).json({ error: 'Fotka nenalezena' });
  db.prepare('DELETE FROM item_photos WHERE id = ?').run(ph.id);
  removePhotoFiles(ph.filename);
  res.json({ ok: true });
});

// Servírování fotek — vyžaduje platný token (v query, protože <img> neumí hlavičky).
router.get('/photos/:filename', (req, res) => {
  const t = String(req.query.t || '');
  try { jwt.verify(t, jwtSecret); } catch { return res.status(401).json({ error: 'Chybějící nebo neplatný token' }); }
  const name = String(req.params.filename);
  if (path.basename(name) !== name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
    return res.status(400).json({ error: 'Neplatný název souboru' });
  }
  const file = path.join(photosDir, name);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Fotka nenalezena' });
  res.sendFile(file);
});

module.exports = router;
