import { useState } from 'react';
import { useAuth } from '../auth';
import { api } from '../api';

export default function Settings() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function changePassword(e) {
    e.preventDefault();
    setMsg(''); setError('');
    try {
      await api('/api/auth/password', { method: 'PATCH', body: { currentPassword, newPassword } });
      setMsg('Heslo změněno.');
      setCurrentPassword(''); setNewPassword('');
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <h2>Nastavení</h2>
      <div className="card">
        <h3>Přihlášen jako: {user?.username} ({user?.role === 'admin' ? 'admin' : 'uživatel'})</h3>
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
    </div>
  );
}
