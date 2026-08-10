const jwt = require('jsonwebtoken');
const { jwtSecret, db } = require('./db');

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, jwtSecret, { expiresIn: '30d' });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin required' });
  next();
}

module.exports = { signToken, requireAuth, requireAdmin };
