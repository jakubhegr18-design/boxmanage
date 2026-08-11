const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const { db, ensureAdminUser } = require('./db');
const authRoutes = require('./routes/auth');
const boxesRoutes = require('./routes/boxes');
const itemsRoutes = require('./routes/items');
const locationsRoutes = require('./routes/locations');
const movementsRoutes = require('./routes/movements');
const exportRoutes = require('./routes/export');
const labelsRoutes = require('./routes/labels');
const statsRoutes = require('./routes/stats');

const app = express();
app.use(express.json());

// CORS pro nativní mobilní aplikaci (Capacitor WebView má origin https://localhost)
// a pro případné jiné klienty. PWA v prohlížeči běží na stejném originu, takže se jí to netýká.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/boxes', boxesRoutes);
app.use('/api', itemsRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/movements', movementsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api', labelsRoutes);
app.use('/api/stats', statsRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

const webDir = process.env.WEB_DIR || path.resolve(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(webDir)) {
  app.use(express.static(webDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(webDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('BoxManage API beží. Web build zatím neexistuje (spusť "npm run build" ve složce web/).');
  });
}

ensureAdminUser();

const PORT = Number(process.env.PORT || 8090);
app.listen(PORT, () => {
  console.log(`[boxmanage] Server listening on http://0.0.0.0:${PORT}`);
});
