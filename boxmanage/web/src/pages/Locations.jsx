import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadFile } from '../api';
import { useAuth } from '../auth';
import { Edit, Trash, Bulb, QrCode, Plus } from '../components/Icons';

const LOCATION_TYPES = [
  { value: '', label: 'Běžná lokace' },
  { value: 'skříň', label: 'Skříň' },
];

export default function Locations() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState('');
  const [editing, setEditing] = useState(null);
  const [findMsg, setFindMsg] = useState('');
  const [findBusy, setFindBusy] = useState(false);
  const isAdmin = user?.role === 'admin';

  const [expandedLoc, setExpandedLoc] = useState(null);
  const [drawers, setDrawers] = useState([]);
  const [newDrawerName, setNewDrawerName] = useState('');
  const [editingDrawer, setEditingDrawer] = useState(null);

  function load() {
    api('/api/locations').then(setItems).catch(() => {});
  }

  useEffect(load, []);

  const loadDrawers = useCallback((locId) => {
    if (!locId) { setDrawers([]); return; }
    api(`/api/locations/${locId}/drawers`).then(setDrawers).catch(() => setDrawers([]));
  }, []);

  useEffect(() => {
    if (expandedLoc) loadDrawers(expandedLoc);
    else setDrawers([]);
  }, [expandedLoc, loadDrawers]);

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api('/api/locations', { method: 'POST', body: { name, description: desc, type } });
      setName(''); setDesc(''); setType('');
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
          type: editing.type,
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
    if (expandedLoc === loc.id) setExpandedLoc(null);
    load();
  }

  async function addDrawer(e) {
    e.preventDefault();
    if (!newDrawerName.trim()) return;
    try {
      await api(`/api/locations/${expandedLoc}/drawers`, { method: 'POST', body: { name: newDrawerName.trim() } });
      setNewDrawerName('');
      loadDrawers(expandedLoc);
    } catch (err) { setError(err.message); }
  }

  async function updateDrawer(e) {
    e.preventDefault();
    if (!editingDrawer?.name?.trim()) return;
    try {
      await api(`/api/locations/${expandedLoc}/drawers/${editingDrawer.id}`, {
        method: 'PATCH',
        body: { name: editingDrawer.name.trim() },
      });
      setEditingDrawer(null);
      loadDrawers(expandedLoc);
    } catch (err) { setError(err.message); }
  }

  async function deleteDrawer(drawer) {
    if (!window.confirm(`Smazat šuplík "${drawer.name}"? Krabice v něm zůstanou bez šuplíku.`)) return;
    try {
      await api(`/api/locations/${expandedLoc}/drawers/${drawer.id}`, { method: 'DELETE' });
      loadDrawers(expandedLoc);
    } catch (err) { setError(err.message); }
  }

  function typeLabel(t) {
    if (t === 'skříň') return 'Skříň';
    return '';
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
            <div key={l.id} className="box-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div className="box-main">
                  <div className="box-name">
                    {l.name}
                    {l.type === 'skříň' && <span className="badge" style={{ marginLeft: 8 }}>Skříň</span>}
                  </div>
                  {l.description && <div className="muted small">{l.description}</div>}
                  {l.light_entity && (
                    <div className="muted small loc-light">
                      <Bulb size={12} /> {l.light_entity}
                      {Number(l.light_on_scan) === 1 && ' · rozsvítit při skenování'}
                    </div>
                  )}
                </div>
                <div className="box-side">
                  <button className="btn btn-sm" onClick={() => downloadFile(`/api/locations/${l.id}/label.png`, `location-${l.id}-label.png`)} aria-label="QR štítek" title="Stáhnout QR štítek lokace"><QrCode size={15} /></button>
                  <Link className="badge" to={`/boxes?location=${l.id}`}>{l.box_count} krabic</Link>
                  {isAdmin && (
                    <span className="row-actions">
                      <button className="btn btn-sm" onClick={() => setExpandedLoc(expandedLoc === l.id ? null : l.id)} title="Šuplíky">
                        <Plus size={15} /> {l.drawer_count || 0}
                      </button>
                      <button className="btn btn-sm" onClick={() => setEditing({ id: l.id, name: l.name, description: l.description || '', type: l.type || '', lightEntity: l.light_entity || '', lightOnScan: Number(l.light_on_scan) === 1 })} aria-label="Upravit"><Edit size={15} /></button>
                      <button className="btn btn-sm btn-danger" onClick={() => del(l)} aria-label="Smazat"><Trash size={15} /></button>
                    </span>
                  )}
                </div>
              </div>

              {expandedLoc === l.id && isAdmin && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div className="muted small strong" style={{ marginBottom: 8 }}>Šuplíky</div>
                  {drawers.length === 0 && <p className="muted small">Žádné šuplíky.</p>}
                  {drawers.length > 0 && (
                    <div className="box-list" style={{ gap: 6 }}>
                      {drawers.map((d) => (
                        <div key={d.id} className="box-card" style={{ padding: '8px 12px' }}>
                          {editingDrawer?.id === d.id ? (
                            <form onSubmit={updateDrawer} style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                              <input className="input" style={{ flex: 1 }} value={editingDrawer.name} onChange={(e) => setEditingDrawer({ ...editingDrawer, name: e.target.value })} autoFocus />
                              <button className="btn btn-sm btn-primary" type="submit">Uložit</button>
                              <button className="btn btn-sm" type="button" onClick={() => setEditingDrawer(null)}>Zrušit</button>
                            </form>
                          ) : (
                            <>
                              <div className="box-main">
                                <div className="box-name" style={{ fontSize: '0.92rem' }}>{d.name}</div>
                              </div>
                              <div className="box-side" style={{ flexDirection: 'row', gap: 5 }}>
                                <Link className="badge" to={`/boxes?drawer=${d.id}`}>{d.box_count} krabic</Link>
                                <button className="btn btn-sm" onClick={() => setEditingDrawer({ id: d.id, name: d.name })} aria-label="Upravit"><Edit size={14} /></button>
                                <button className="btn btn-sm btn-danger" onClick={() => deleteDrawer(d)} aria-label="Smazat"><Trash size={14} /></button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <form onSubmit={addDrawer} className="row" style={{ marginTop: 8 }}>
                    <input className="input" placeholder="Název šuplíku" value={newDrawerName} onChange={(e) => setNewDrawerName(e.target.value)} style={{ flex: 1 }} />
                    <button className="btn btn-sm btn-primary" type="submit" disabled={!newDrawerName.trim()}>Přidat šuplík</button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isAdmin && !editing && (
        <form onSubmit={add} className="card form">
          <h3>Nová lokace</h3>
          <label className="label">Název</label>
          <input className="input" placeholder="např. Garáž regál B" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="label">Typ</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {LOCATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
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
          <label className="label">Typ</label>
          <select className="input" value={editing.type || ''} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
            {LOCATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
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
