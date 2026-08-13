const fs = require('node:fs');
const path = require('node:path');
const { db, getSetting, dataDir } = require('./db');

const TOKEN_KEY = 'telegram_token';
const CHAT_ID_KEY = 'telegram_chat_id';
const ENABLED_KEY = 'telegram_enabled';
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const PHOTOS_DIR = path.join(dataDir, 'photos');

function esc(s) {
  return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtQty(n) {
  const num = Number(n);
  if (!isFinite(num)) return '';
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '');
}

function telegramConfig() {
  return {
    enabled: getSetting(ENABLED_KEY, '0') === '1',
    token: getSetting(TOKEN_KEY, ''),
    chatId: getSetting(CHAT_ID_KEY, ''),
  };
}

async function sendTelegram(text) {
  const { enabled, token, chatId } = telegramConfig();
  if (!enabled || !token || !chatId) {
    return { ok: false, error: 'Telegram není nakonfigurován' };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.ok) return { ok: true };
    return { ok: false, error: data.description || `Telegram API odpověděl ${res.status}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Pošle fotku krabice s textem jako popiskem (sendPhoto). Když fotka není,
// pošle jen textovou zprávu.
async function sendTelegramWithPhoto(text, filename) {
  const { enabled, token, chatId } = telegramConfig();
  if (!enabled || !token || !chatId) {
    return { ok: false, error: 'Telegram není nakonfigurován' };
  }
  const file = path.join(PHOTOS_DIR, String(filename));
  if (!filename || !file.startsWith(PHOTOS_DIR) || !fs.existsSync(file)) return sendTelegram(text);
  try {
    const ext = (path.extname(file).toLowerCase() || '.jpg').replace('.', '');
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('parse_mode', 'HTML');
    form.append('caption', text);
    form.append('photo', new Blob([fs.readFileSync(file)], { type: `image/${ext === 'jpg' ? 'jpeg' : ext}` }), `photo.${ext}`);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (data.ok) return { ok: true };
    return { ok: false, error: data.description || `Telegram API odpověděl ${res.status}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Zkontroluje položku s nastaveným limitem (alert_threshold). Pokud je množství
// na/kolís pod limitem, pošle upozornění. Opakování je omezeno cooldownem (24 h),
// okamžitě se pošle, když stav teprve klesne pod limit.
// Upozornění je vypnuté, když má položka nebo celá krabice alert_enabled = 0.
async function checkItemAlert(itemId, previousQty) {
  const item = db.prepare(`
    SELECT i.*, b.name AS box_name, b.position AS box_position,
      b.alert_enabled AS box_alert_enabled, l.name AS location_name
    FROM items i
    JOIN boxes b ON b.id = i.box_id
    LEFT JOIN locations l ON l.id = b.location_id
    WHERE i.id = ?
  `).get(itemId);
  if (!item) return;
  if (item.alert_enabled === 0 || item.box_alert_enabled === 0) return;
  if (item.alert_threshold === null || item.alert_threshold === undefined) return;

  const threshold = Number(item.alert_threshold);
  const qty = Number(item.quantity);
  if (!isFinite(threshold)) return;

  if (qty > threshold) {
    // Stav se vrátil nad limit — vynulujeme cooldown, ať při dalším poklesu
    // upozornění přijde hned.
    db.prepare('UPDATE items SET last_alert_at = NULL WHERE id = ?').run(item.id);
    return;
  }

  const crossed = previousQty !== undefined && Number(previousQty) > threshold;
  let last = 0;
  if (item.last_alert_at) {
    const t = new Date(String(item.last_alert_at).replace(' ', 'T') + 'Z').getTime();
    if (!isNaN(t)) last = t;
  }
  if (!crossed && last && Date.now() - last < ALERT_COOLDOWN_MS) return;

  const boxName = item.box_name || item.box_id;
  const text = `<b>⚠️ Nízký stav — ${esc(boxName)}</b>\n` +
    (item.box_position ? `Pozice: <b>${esc(item.box_position)}</b>\n` : '') +
    (item.location_name ? `Lokace: <b>${esc(item.location_name)}</b>\n` : '') +
    `Položka: <b>${esc(item.name)}</b>\n` +
    `Zbývá: <b>${fmtQty(qty)} ${esc(item.unit || '')}</b> (limit ${fmtQty(threshold)} ${esc(item.unit || '')})`;

  const photo = db.prepare('SELECT filename FROM box_photos WHERE box_id = ? ORDER BY created_at DESC LIMIT 1').get(item.box_id);
  const result = photo?.filename
    ? await sendTelegramWithPhoto(text, photo.filename)
    : await sendTelegram(text);
  if (result.ok) {
    db.prepare('UPDATE items SET last_alert_at = datetime(\'now\') WHERE id = ?').run(item.id);
  } else {
    console.error('[boxmanage] Upozornění na nízký stav nebylo odesláno:', result.error);
  }
}

// Periodická kontrola všech sledovaných položek (např. po importu nebo nastavení
// limitu, kdy k poklesu nedošlo přes běžný pohyb). Cooldown zamezí opakovanému
// odesílání vícenásobně.
async function sweepLowStock() {
  const items = db.prepare(`
    SELECT i.id FROM items i
    JOIN boxes b ON b.id = i.box_id
    WHERE i.alert_threshold IS NOT NULL AND i.alert_enabled = 1 AND b.alert_enabled = 1
  `).all();
  for (const it of items) {
    try {
      await checkItemAlert(it.id);
    } catch (err) {
      console.error('[boxmanage] Sweep nízkého stavu selhal:', err.message);
    }
  }
}

module.exports = { sendTelegram, checkItemAlert, sweepLowStock };
