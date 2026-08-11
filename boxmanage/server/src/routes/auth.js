const express = require('express');
const bcrypt = require('bcryptjs');
const { db, logMovement } = require('../db');
const { signToken, requireAuth, requireAdmin } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Špatné uživatelské jméno nebo heslo' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json(publicUser(req.user));
});

router.post('/register', requireAuth, requireAdmin, (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (String(password).length < 4) return res.status(400).json({ error: 'Heslo musí mít alespoň 4 znaky' });
  const name = String(username).toLowerCase().trim();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(name);
  if (existing) return res.status(409).json({ error: 'Uživatel už existuje' });
  const hash = bcrypt.hashSync(String(password), 10);
  const r = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(name, hash, role === 'admin' ? 'admin' : 'user');
  res.status(201).json(publicUser(db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(r.lastInsertRowid)));
});

router.patch('/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user || !bcrypt.compareSync(String(currentPassword || ''), user.password_hash)) {
    return res.status(400).json({ error: 'Současné heslo je špatně' });
  }
  if (!newPassword || String(newPassword).length < 4) return res.status(400).json({ error: 'Heslo musí mít alespoň 4 znaky' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(newPassword), 10), req.user.id);
  res.json({ ok: true });
});

router.patch('/username', requireAuth, (req, res) => {
  const { currentPassword, newUsername } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user || !bcrypt.compareSync(String(currentPassword || ''), user.password_hash)) {
    return res.status(400).json({ error: 'Současné heslo je špatně' });
  }
  const name = String(newUsername || '').toLowerCase().trim();
  if (!name) return res.status(400).json({ error: 'Uživatelské jméno je povinné' });
  if (name.length > 50) return res.status(400).json({ error: 'Uživatelské jméno je moc dlouhé (max 50 znaků)' });
  if (name === user.username) return res.json(publicUser({ id: user.id, username: user.username, role: user.role, created_at: user.created_at }));
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(name);
  if (existing) return res.status(409).json({ error: 'Toto uživatelské jméno už používá jiný účet' });
  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(name, req.user.id);
  res.json(publicUser(db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(req.user.id)));
});

router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY username').all();
  res.json(rows);
});

router.patch('/users/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Uživatel nenalezen' });
  const { role, password, username } = req.body || {};
  if (username !== undefined && username !== null && String(username).trim() !== '' && String(username).trim() !== user.username) {
    const name = String(username).toLowerCase().trim();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(name);
    if (existing && existing.id !== id) return res.status(409).json({ error: 'Toto uživatelské jméno už používá jiný účet' });
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(name, id);
  }
  if (role && role !== user.role) {
    if (user.role === 'admin' && role !== 'admin') {
      const admins = db.prepare('SELECT COUNT(*) AS c FROM users WHERE role = ?').get('admin').c;
      if (admins <= 1) return res.status(400).json({ error: 'Nelze odebrat admina, je poslední' });
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  }
  if (password) {
    if (String(password).length < 4) return res.status(400).json({ error: 'Heslo musí mít alespoň 4 znaky' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(password), 10), id);
  }
  res.json(publicUser(db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(id)));
});

router.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Nelze smazat sám sebe' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Uživatel nenalezen' });
  if (user.role === 'admin') {
    const admins = db.prepare('SELECT COUNT(*) AS c FROM users WHERE role = ?').get('admin').c;
    if (admins <= 1) return res.status(400).json({ error: 'Nelze smazat posledního admina' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

function publicUser(u) {
  return { id: u.id, username: u.username, role: u.role, created_at: u.created_at };
}

module.exports = router;
