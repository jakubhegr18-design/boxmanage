import { useState } from 'react';
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
    </div>
  );
}
