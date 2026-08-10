import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Edit, Trash } from '../components/Icons';

export default function Locations() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [editing, setEditing] = useState(null);
  const isAdmin = user?.role === 'admin';

  function load() {
    api('/api/locations').then(setItems).catch(() => {});
  }

  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api('/api/locations', { method: 'POST', body: { name, description: desc } });
      setName(''); setDesc('');
      load();
    } catch (err) { setError(err.message); }
  }

  async function update(e) {
    e.preventDefault();
    try {
      await api(`/api/locations/${editing.id}`, { method: 'PATCH', body: { name: editing.name, description: editing.description } });
      setEditing(null);
      load();
    } catch (err) { setError(err.message); }
  }

  async function del(loc) {
    if (!window.confirm(`Smazat lokaci "${loc.name}"? Krabice v ní zůstanou bez lokace.`)) return;
    await api(`/api/locations/${loc.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <h2>Lokace</h2>

      {items.length === 0 && !isAdmin ? (
        <p className="muted">Žádné lokace.</p>
      ) : (
        <div className="box-list">
          {items.map((l) => (
            <div key={l.id} className="box-card">
              <div className="box-main">
                <div className="box-name">{l.name}</div>
                {l.description && <div className="muted small">{l.description}</div>}
              </div>
              <div className="box-side">
                <Link className="badge" to={`/boxes?location=${l.id}`}>{l.box_count} krabic</Link>
                {isAdmin && (
                  <span className="row-actions">
                    <button className="btn btn-sm" onClick={() => setEditing({ id: l.id, name: l.name, description: l.description || '' })} aria-label="Upravit"><Edit size={15} /></button>
                    <button className="btn btn-sm btn-danger" onClick={() => del(l)} aria-label="Smazat"><Trash size={15} /></button>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && !editing && (
        <form onSubmit={add} className="card form">
          <h3>Nová lokace</h3>
          <label className="label">Název</label>
          <input className="input" placeholder="např. Garáž regál B" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="label">Popis</label>
          <input className="input" placeholder="nepovinné" value={desc} onChange={(e) => setDesc(e.target.value)} />
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary" type="submit">Přidat lokaci</button>
        </form>
      )}

      {isAdmin && editing && (
        <form onSubmit={update} className="card form">
          <h3>Upravit lokaci</h3>
          <label className="label">Název</label>
          <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <label className="label">Popis</label>
          <input className="input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setEditing(null)}>Zrušit</button>
            <button className="btn btn-primary" type="submit">Uložit</button>
          </div>
        </form>
      )}
    </div>
  );
}
