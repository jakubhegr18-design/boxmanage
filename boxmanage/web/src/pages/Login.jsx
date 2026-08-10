import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';

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
        <div className="login-logo">📦</div>
        <h1>BoxManage</h1>
        <p className="muted">Inventura krabic s QR kódy</p>
        <form onSubmit={submit}>
          <input
            className="input"
            placeholder="Uživatelské jméno"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />
          <input
            className="input"
            type="password"
            placeholder="Heslo"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Přihlašuji…' : 'Přihlásit se'}
          </button>
        </form>
        <p className="muted small">Výchozí účet: <code>admin</code> / <code>admin</code> (změň v Nastavení)</p>
      </div>
    </div>
  );
}
