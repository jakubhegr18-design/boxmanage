import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { getApiBase, setApiBase, normalizeServerUrl } from '../api';
import { isNative } from '../ble/backend';
import { BrandMark, Users as UserIcon, Lock, Settings as SettingsIcon } from '../components/Icons';

export default function Login() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [server, setServer] = useState(getApiBase());
  const [serverMsg, setServerMsg] = useState('');
  const [serverError, setServerError] = useState('');
  const [testing, setTesting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function saveServer() {
    setServerError(''); setServerMsg('');
    setApiBase(server);
    setServerMsg('Adresa uložena.');
  }

  async function testServer() {
    setServerError(''); setServerMsg('');
    const base = normalizeServerUrl(server);
    if (!base) {
      setServerError('Zadej adresu serveru, např. https://192.168.1.123:8090');
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(base + '/api/auth/me');
      if (res.status === 401) setServerMsg('Spojení OK — server je dostupný, můžeš se přihlásit.');
      else if (res.ok) setServerMsg('Spojení OK.');
      else setServerError(`Server odpověděl: ${res.status}`);
    } catch (err) {
      setServerError(`Nelze se připojit: ${err.message}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <BrandMark size={64} />
        </div>
        <h1>BoxManage</h1>
        <p className="muted">Inventura krabic s QR kódy</p>
        <form onSubmit={submit}>
          <div className="field">
            <span className="f-ico"><UserIcon size={18} /></span>
            <input
              className="input"
              placeholder="Uživatelské jméno"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="field">
            <span className="f-ico"><Lock size={18} /></span>
            <input
              className="input"
              type="password"
              placeholder="Heslo"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
            {busy ? 'Přihlašuji…' : 'Přihlásit se'}
          </button>
        </form>

        {isNative() && (
          <div className="login-server">
            <h2><SettingsIcon size={15} /> Adresa serveru</h2>
            <p className="muted small">V mobilní aplikaci se BoxManage připojuje na adresu add-onu, např. <code>https://192.168.1.123:8090</code>. Vyplň, ulož a pak se přihlas.</p>
            <input
              className="input"
              placeholder="https://192.168.1.123:8090"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              inputMode="url"
              autoCapitalize="none"
            />
            {serverError && <div className="alert alert-error">{serverError}</div>}
            {serverMsg && <div className="alert alert-info">{serverMsg}</div>}
            <div className="row">
              <button className="btn" type="button" onClick={saveServer}>Uložit adresu</button>
              <button className="btn" type="button" onClick={testServer} disabled={testing}>
                {testing ? 'Testuji…' : 'Otestovat'}
              </button>
            </div>
          </div>
        )}

        <p className="login-foot">
          Výchozí účet: <code>admin</code> / <code>admin</code> — změň ho v Nastavení.
        </p>
      </div>
    </div>
  );
}
