// Web Push (PWA) — upozornění v prohlížeči/na telefonu s nainstalovanou PWA.
// Server generuje VAPID klíče při prvním startu (uložené v nastavení) a odesílá
// notifikace na uložené odběry (push_subscriptions). Odesílání je best-effort.
const express = require('express');
const webpush = require('web-push');
const { db, getSetting, setSetting } = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();

let configured = false;
function ensureConfigured() {
  if (configured) return;
  let publicKey = getSetting('vapid_public_key', '');
  let privateKey = getSetting('vapid_private_key', '');
  if (!publicKey || !privateKey) {
    const keys = webpush.generateVAPIDKeys();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    setSetting('vapid_public_key', publicKey);
    setSetting('vapid_private_key', privateKey);
  }
  webpush.setVapidDetails(
    getSetting('vapid_subject', 'mailto:admin@boxmanage.local'),
    publicKey,
    privateKey,
  );
  configured = true;
}

// Pošle notifikaci na všechny uložené odběry. Vrátí počet odeslaných.
async function notifyPush({ title, body, url }) {
  try {
    ensureConfigured();
  } catch (err) {
    console.error('[push] VAPID nastavení selhalo:', err.message);
    return 0;
  }
  const subs = db.prepare('SELECT * FROM push_subscriptions').all();
  if (subs.length === 0) return 0;
  const payload = JSON.stringify({ title, body, url, data: { url } });
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { auth: s.auth, p256dh: s.p256dh } },
        payload,
      );
      sent++;
    } catch (err) {
      // 404/410 = předplatné už neexistuje — smažeme ho.
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(s.endpoint);
      } else {
        console.error('[push] Odeslání notifikace selhalo:', err.message);
      }
    }
  }
  return sent;
}

// Veřejný klíč pro service worker (pushManager.subscribe) — jen pro přihlášené.
router.get('/vapid-key', requireAuth, (req, res) => {
  ensureConfigured();
  res.json({ publicKey: getSetting('vapid_public_key', '') });
});

// Uloží odběr pro aktuálního uživatele (upsert podle endpointu).
router.post('/subscribe', requireAuth, (req, res) => {
  const sub = req.body?.subscription;
  const endpoint = String(sub?.endpoint || '').trim();
  const auth = String(sub?.keys?.auth || '').trim();
  const p256dh = String(sub?.keys?.p256dh || '').trim();
  if (!endpoint || !auth || !p256dh) {
    return res.status(400).json({ error: 'Neplatné push předplatné' });
  }
  const existing = db.prepare('SELECT id, user_id FROM push_subscriptions WHERE endpoint = ?').get(endpoint);
  if (existing) {
    db.prepare('UPDATE push_subscriptions SET user_id = ?, auth = ?, p256dh = ? WHERE id = ?')
      .run(req.user.id, auth, p256dh, existing.id);
  } else {
    db.prepare('INSERT INTO push_subscriptions (user_id, endpoint, auth, p256dh) VALUES (?, ?, ?, ?)')
      .run(req.user.id, endpoint, auth, p256dh);
  }
  res.json({ ok: true });
});

// Smaže odběr (odhlášení notifikací).
router.post('/unsubscribe', requireAuth, (req, res) => {
  const endpoint = String(req.body?.endpoint || '').trim();
  if (endpoint) {
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(endpoint, req.user.id);
  }
  res.json({ ok: true });
});

// Testovací notifikace pro aktuálního uživatele.
router.post('/test', requireAuth, async (req, res) => {
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(req.user.id);
  if (subs.length === 0) {
    return res.status(400).json({ error: 'Nejsi přihlášen k odběru notifikací' });
  }
  const sent = await notifyPush({
    title: 'BoxManage',
    body: 'Testovací notifikace — funguje to!',
    url: '/',
  });
  res.json({ ok: true, sent });
});

module.exports = { pushRouter: router, notifyPush };
