import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { api, getApiBase, setApiBase } from '../api';
import { isNative } from '../ble/backend';

export default function Settings() {
  const { user, refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [namePassword, setNamePassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [apiUrl, setApiUrl] = useState(getApiBase());
  const [apiMsg, setApiMsg] = useState('');
  const [apiError, setApiError] = useState('');
  const [testing, setTesting] = useState(false);
  const [tg, setTg] = useState({ enabled: false, chatId: '', token: '', hasToken: false });
  const [tgMsg, setTgMsg] = useState('');
  const [tgError, setTgError] = useState('');
  const [tgTesting, setTgTesting] = useState(false);

  useEffect(() => {
    api('/api/settings').then((s) => {
      setTg({ enabled: s.telegram.enabled, chatId: s.telegram.chatId, token: '', hasToken: s.telegram.hasToken });
    }).catch(() => {});
  }, []);

  async function changePassword(e) {
    e.preventDefault();
    setMsg(''); setError('');
    try {
      await api('/api/auth/password', { method: 'PATCH', body: { currentPassword, newPassword } });
      setMsg('Heslo změněno.');
      setCurrentPassword(''); setNewPassword('');
    } catch (err) { setError(err.message); }
  }

  async function changeUsername(e) {
    e.preventDefault();
    setMsg(''); setError('');
    try {
      const u = await api('/api/auth/username', { method: 'PATCH', body: { currentPassword: namePassword, newUsername } });
      await refresh();
      setMsg(`Uživatelské jméno změněno na "${u.username}".`);
      setNamePassword(''); setNewUsername('');
    } catch (err) { setError(err.message); }
  }

  function saveApiUrl() {
    setApiMsg(''); setApiError('');
    setApiBase(apiUrl);
    setApiMsg('Adresa uložena.');
  }

  async function testApi() {
    setApiMsg(''); setApiError('');
    setTesting(true);
    const prev = getApiBase();
    setApiBase(apiUrl);
    try {
      const me = await api('/api/auth/me');
      setApiMsg(`Spojení OK — přihlášen jako ${me.username}.`);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setApiBase(prev);
      setTesting(false);
    }
  }

  async function saveTelegram(e) {
    e.preventDefault();
    setTgMsg(''); setTgError('');
    try {
      const s = await api('/api/settings/telegram', {
        method: 'PUT',
        body: { enabled: tg.enabled, chatId: tg.chatId, token: tg.token },
      });
      setTg({ ...s.telegram, token: '' });
      setTgMsg('Nastavení Telegramu uloženo.');
    } catch (err) { setTgError(err.message); }
  }

  async function testTelegram() {
    setTgMsg(''); setTgError(''); setTgTesting(true);
    try {
      const r = await api('/api/settings/telegram/test', { method: 'POST' });
      if (r.ok) setTgMsg('Testovací zpráva odeslána.');
      else setTgError(r.error || 'Test selhal.');
    } catch (err) { setTgError(err.message); }
    finally { setTgTesting(false); }
  }

  return (
    <div>
      <h2>Nastavení</h2>
      <div className="card">
        <h3>Přihlášen jako: {user?.username} ({user?.role === 'admin' ? 'admin' : 'uživatel'})</h3>
        <form onSubmit={changeUsername}>
          <label className="label">Nové uživatelské jméno</label>
          <input className="input" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} autoComplete="username" placeholder={user?.username} />
          <label className="label">Současné heslo (pro ověření)</label>
          <input className="input" type="password" value={namePassword} onChange={(e) => setNamePassword(e.target.value)} autoComplete="current-password" />
          {error && <div className="alert alert-error">{error}</div>}
          {msg && <div className="alert alert-info">{msg}</div>}
          <button className="btn btn-primary" type="submit">Změnit uživatelské jméno</button>
        </form>
      </div>
      <div className="card">
        <h3>Změnit heslo</h3>
        <form onSubmit={changePassword}>
          <label className="label">Současné heslo</label>
          <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          <label className="label">Nové heslo</label>
          <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          {error && <div className="alert alert-error">{error}</div>}
          {msg && <div className="alert alert-info">{msg}</div>}
          <button className="btn btn-primary" type="submit">Změnit heslo</button>
        </form>
      </div>

      {isNative() && (
        <div className="card">
          <h3>Adresa serveru (mobilní aplikace)</h3>
          <p className="muted">
            Mobilní aplikace se k BoxManage připojuje přes HTTP (port 8092 add-onu). Zadej adresu ve tvaru http://192.168.1.x:8092.
          </p>
          <input className="input" placeholder="http://192.168.1.123:8092" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
          {apiError && <div className="alert alert-error">{apiError}</div>}
          {apiMsg && <div className="alert alert-info">{apiMsg}</div>}
          <div className="row">
            <button className="btn btn-primary" onClick={saveApiUrl}>Uložit</button>
            <button className="btn" onClick={testApi} disabled={testing}>{testing ? 'Testuji…' : 'Otestovat připojení'}</button>
          </div>
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="card">
          <h3>Telegram — upozornění na nízký stav</h3>
          <p className="muted">
            Když vybraná položka klesne na nebo pod svůj limit, pošle se zpráva do chatu.
            Limit se nastavuje u položky v detailu krabice („Upozornit při nízkém stavu“).
            Token vytvoříš v Telegramu u @BotFather, chat ID je číslo, které ti bot odpoví po startu rozhovoru.
          </p>
          <form onSubmit={saveTelegram}>
            <label className="label">Bot token</label>
            <input
              className="input"
              type="password"
              autoComplete="off"
              placeholder={tg.hasToken ? '…nastaveno (zadej nový pro změnu)' : '123456:ABC-…'}
              value={tg.token}
              onChange={(e) => setTg({ ...tg, token: e.target.value })}
            />
            <label className="label">Chat ID</label>
            <input
              className="input"
              placeholder="123456789"
              value={tg.chatId}
              onChange={(e) => setTg({ ...tg, chatId: e.target.value })}
            />
            <label className="label-inline" style={{ margin: '12px 0' }}>
              <input
                type="checkbox"
                checked={tg.enabled}
                onChange={(e) => setTg({ ...tg, enabled: e.target.checked })}
              />
              Odesílat upozornění
            </label>
            {tgError && <div className="alert alert-error">{tgError}</div>}
            {tgMsg && <div className="alert alert-info">{tgMsg}</div>}
            <div className="row">
              <button className="btn btn-primary" type="submit">Uložit</button>
              <button type="button" className="btn" onClick={testTelegram} disabled={tgTesting}>
                {tgTesting ? 'Odesílám…' : 'Poslat testovací zprávu'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
