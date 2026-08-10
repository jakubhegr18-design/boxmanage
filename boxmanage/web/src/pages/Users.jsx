import { useEffect, useState } from 'react';
import { api, fmtDate } from '../api';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [editUser, setEditUser] = useState(null);

  function load() {
    api('/api/auth/users').then(setUsers).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    try {
      await api('/api/auth/register', { method: 'POST', body: { username, password, role } });
      setUsername(''); setPassword(''); setRole('user');
      load();
    } catch (err) { setError(err.message); }
  }

  async function saveEdit(e) {
    e.preventDefault();
    const body = {};
    if (editUser.role) body.role = editUser.role;
    if (editUser.password) body.password = editUser.password;
    try {
      await api(`/api/auth/users/${editUser.id}`, { method: 'PATCH', body });
      setEditUser(null);
      load();
    } catch (err) { setError(err.message); }
  }

  async function del(u) {
    if (!window.confirm(`Smazat uživatele "${u.username}"?`)) return;
    try {
      await api(`/api/auth/users/${u.id}`, { method: 'DELETE' });
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <h2>Uživatelé</h2>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <table className="table">
          <thead><tr><th>Uživatel</th><th>Role</th><th>Vytvořen</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="strong">{u.username}</td>
                <td>{u.role === 'admin' ? 'Admin' : 'Uživatel'}</td>
                <td className="muted">{fmtDate(u.created_at)}</td>
                <td className="row-actions">
                  <button className="btn btn-sm" onClick={() => setEditUser({ id: u.id, username: u.username, role: u.role, password: '' })}>✏️</button>
                  <button className="btn btn-sm btn-danger" onClick={() => del(u)}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!editUser && (
        <form onSubmit={add} className="card form">
          <h3>Nový uživatel</h3>
          <label className="label">Uživatelské jméno</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
          <label className="label">Heslo</label>
          <input className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className="label">Role</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">Uživatel</option>
            <option value="admin">Admin</option>
          </select>
          <button className="btn btn-primary" type="submit">Přidat</button>
        </form>
      )}

      {editUser && (
        <form onSubmit={saveEdit} className="card form">
          <h3>Upravit uživatele: {editUser.username}</h3>
          <label className="label">Role</label>
          <select className="input" value={editUser.role} onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}>
            <option value="user">Uživatel</option>
            <option value="admin">Admin</option>
          </select>
          <label className="label">Nové heslo (nepovinné)</label>
          <input className="input" type="text" value={editUser.password} onChange={(e) => setEditUser({ ...editUser, password: e.target.value })} placeholder="prázdné = neměnit" />
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setEditUser(null)}>Zrušit</button>
            <button className="btn btn-primary" type="submit">Uložit</button>
          </div>
        </form>
      )}
    </div>
  );
}
