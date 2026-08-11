const express = require('express');
const { getSetting, setSetting } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { sendTelegram } = require('../telegram');

const router = express.Router();

function telegramPayload() {
  return {
    enabled: getSetting('telegram_enabled', '0') === '1',
    chatId: getSetting('telegram_chat_id', ''),
    hasToken: !!getSetting('telegram_token', ''),
  };
}

router.get('/', requireAuth, (req, res) => {
  res.json({ telegram: telegramPayload() });
});

router.put('/telegram', requireAuth, requireAdmin, (req, res) => {
  const { enabled, chatId, token } = req.body || {};
  setSetting('telegram_enabled', enabled ? '1' : '0');
  setSetting('telegram_chat_id', String(chatId || '').trim());
  if (token && typeof token === 'string' && String(token).trim()) {
    setSetting('telegram_token', String(token).trim());
  }
  res.json({ telegram: telegramPayload() });
});

router.post('/telegram/test', requireAuth, requireAdmin, async (req, res) => {
  const result = await sendTelegram('<b>BoxManage</b> — testovací zpráva. Funguje to!');
  res.json(result);
});

module.exports = router;
