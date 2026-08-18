// Webhooky — odesílání událostí BoxManage ven (např. do Home Assistant,
// Node-RED nebo jiné automatizace). Konfigurace žije v nastavení:
//   webhook_enabled = '1'/'0'
//   webhook_urls    = JSON pole URL adres, na které se POSTuje událost.
// Odesílání je best-effort — chyba webhooku nesmí shodit samotnou operaci.

const { getSetting, setSetting } = require('./db');

function webhookConfig() {
  let urls = [];
  try {
    urls = JSON.parse(getSetting('webhook_urls', '[]') || '[]');
  } catch {
    urls = [];
  }
  return {
    enabled: getSetting('webhook_enabled', '0') === '1',
    urls: urls.filter((u) => typeof u === 'string' && u.trim()),
  };
}

function saveWebhookConfig({ enabled, urls }) {
  setSetting('webhook_enabled', enabled ? '1' : '0');
  const clean = (urls || []).map((u) => String(u).trim()).filter(Boolean);
  setSetting('webhook_urls', JSON.stringify(clean));
  return webhookConfig();
}

// Událost: { event, box?: {id,name,position,location_name}, user?: {id,username}, at, detail }
async function notifyWebhooks(event) {
  const { enabled, urls } = webhookConfig();
  if (!enabled || urls.length === 0) return { ok: true, sent: 0 };
  let sent = 0;
  for (const url of urls) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(5000),
      });
      sent++;
    } catch (err) {
      console.error('[webhook] Odeslání události selhalo:', url, err.message);
    }
  }
  return { ok: true, sent };
}

module.exports = { webhookConfig, saveWebhookConfig, notifyWebhooks };
