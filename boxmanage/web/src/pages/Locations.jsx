import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Edit, Trash, Bulb } from '../components/Icons';

export default function Locations() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [editing, setEditing] = useState(null);
  const [findMsg, setFindMsg] = useState('');
  const [findBusy, setFindBusy] = useState(false);
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
      await api(`/api/locations/${editing.id}`, {
        method: 'PATCH',
        body: {
          name: editing.name,
          description: editing.description,
          lightEntity: editing.lightEntity || '',
          lightOnScan: !!editing.lightOnScan,
        },
      });
      setEditing(null);
      load();
    } catch (err) { setError(err.message); }
  }

  async function testLight(loc) {
    setFindBusy(true);
    setFindMsg('');
    try {
      const r = await api(`/api/locations/${loc.id}/find`, { method: 'POST' });
      setFindMsg(`Světlo „${r.entity}“ zablikalo.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setFindBusy(false);
    }
  }

  async function del(loc) {
    if (!window.confirm(`Smazat lokaci "${loc.name}"? Krabice v ní zůstanou bez lokace.`)) return;
    await api(`/api/locations/${loc.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <h2>Lokace</h2>

      {findMsg && <div className="alert alert-info">{findMsg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {items.length === 0 && !isAdmin ? (
        <p className="muted">Žádné lokace.</p>
      ) : (
        <div className="box-list">
          {items.map((l) => (
            <div key={l.id} className="box-card">
              <div className="box-main">
                <div className="box-name">{l.name}</div>
                {l.description && <div className="muted small">{l.description}</div>}
                {l.light_entity && (
                  <div className="muted small loc-light">
                    <Bulb size={12} /> {l.light_entity}
                    {Number(l.light_on_scan) === 1 && ' · rozsvítit při skenování'}
                  </div>
                )}
              </div>
              <div className="box-side">
                <Link className="badge" to={`/boxes?location=${l.id}`}>{l.box_count} krabic</Link>
                {isAdmin && (
                  <span className="row-actions">
                    <button className="btn btn-sm" onClick={() => setEditing({ id: l.id, name: l.name, description: l.description || '', lightEntity: l.light_entity || '', lightOnScan: Number(l.light_on_scan) === 1 })} aria-label="Upravit"><Edit size={15} /></button>
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
          <label className="label">Světlo v Home Assistant (entity ID)</label>
          <input className="input" placeholder="např. light.garaz_regal_b" value={editing.lightEntity || ''} onChange={(e) => setEditing({ ...editing, lightEntity: e.target.value })} />
          <p className="hint">
            Když má lokace světlo, tlačítko <strong>Najít</strong> na detailu krabice tímto světlem
            zabliká (krabice je v sekci, kde světlo svítí). Entity najdeš v Home Assistant
            v Nastavení → Zařízení (např. light.kuchyn, switch.garaz).
          </p>
          <label className="label-inline" style={{ margin: '8px 0' }}>
            <input
              type="checkbox"
              checked={!!editing.lightOnScan}
              onChange={(e) => setEditing({ ...editing, lightOnScan: e.target.checked })}
            />
            Rozsvítit při naskenování krabice z této lokace
          </label>
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn" onClick={() => testLight(editing)} disabled={findBusy || !editing.lightEntity}>
              <Bulb size={15} /> {findBusy ? 'Blikám…' : 'Testovat světlo'}
            </button>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setEditing(null)}>Zrušit</button>
            <button className="btn btn-primary" type="submit">Uložit</button>
          </div>
        </form>
      )}
    </div>
  );
}
