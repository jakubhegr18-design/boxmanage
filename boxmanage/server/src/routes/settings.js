const express = require('express');
const { getSetting, setSetting } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { sendTelegram, normalizeChatId } = require('../telegram');
const { webhookConfig, saveWebhookConfig } = require('../webhooks');

const router = express.Router();

function telegramPayload() {
  return {
    enabled: getSetting('telegram_enabled', '0') === '1',
    chatId: getSetting('telegram_chat_id', ''),
    hasToken: !!getSetting('telegram_token', ''),
  };
}

function labelsPayload() {
  return {
    showName: getSetting('label_show_name', '1') === '1',
    showPosition: getSetting('label_show_position', '1') === '1',
    showItemQr: getSetting('label_item_qr', '1') === '1',
  };
}

router.get('/', requireAuth, (req, res) => {
  res.json({ telegram: telegramPayload(), labels: labelsPayload(), webhooks: webhookConfig() });
});

router.put('/webhooks', requireAuth, requireAdmin, (req, res) => {
  const { enabled, urls } = req.body || {};
  res.json({ webhooks: saveWebhookConfig({ enabled, urls }) });
});

router.put('/telegram', requireAuth, requireAdmin, (req, res) => {
  const { enabled, chatId, token } = req.body || {};
  const normalized = normalizeChatId(chatId);
  if (!normalized) {
    return res.status(400).json({ error: 'Chat ID musí být celé číslo (může být záporné pro skupiny/kanály)' });
  }
  setSetting('telegram_enabled', enabled ? '1' : '0');
  setSetting('telegram_chat_id', normalized);
  if (token && typeof token === 'string' && String(token).trim()) {
    setSetting('telegram_token', String(token).trim());
  }
  res.json({ telegram: telegramPayload() });
});

router.post('/telegram/test', requireAuth, requireAdmin, async (req, res) => {
  const result = await sendTelegram('<b>BoxManage</b> — testovací zpráva. Funguje to!');
  res.json(result);
});

router.put('/labels', requireAuth, (req, res) => {
  const { showName, showPosition, showItemQr } = req.body || {};
  setSetting('label_show_name', showName ? '1' : '0');
  setSetting('label_show_position', showPosition ? '1' : '0');
  setSetting('label_item_qr', showItemQr ? '1' : '0');
  res.json({ labels: labelsPayload() });
});

module.exports = router;
