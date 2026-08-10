import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { BrandMark, Users as UserIcon, Lock } from '../components/Icons';

export default function Login() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
        <p className="login-foot">
          Výchozí účet: <code>admin</code> / <code>admin</code> — změň ho v Nastavení.
        </p>
      </div>
    </div>
  );
}
