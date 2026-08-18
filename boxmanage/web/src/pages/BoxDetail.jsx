import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api, downloadFile, fmtDate, fmtQty, thumbUrl } from '../api';
import QRLabel from '../components/QRLabel';
import PositionPicker from '../components/PositionPicker';
import QuantityDialog from '../components/QuantityDialog';
import Modal from '../components/Modal';
import PhotoGallery from '../components/PhotoGallery';
import { ChevronLeft, Pin, Edit, Printer, Download, Trash, Bluetooth, Bulb, QrCode } from '../components/Icons';

export default function BoxDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightItem = searchParams.get('item');
  const [box, setBox] = useState(null);
  const [locations, setLocations] = useState([]);
  const [settings, setSettings] = useState(null);
  const [newItem, setNewItem] = useState({ name: '', quantity: 1, unit: '' });
  const [qtyDialog, setQtyDialog] = useState(null);
  const [itemEditor, setItemEditor] = useState(null);
  const [posPicker, setPosPicker] = useState(false);
  const [position, setPosition] = useState('');
  const [moveLoc, setMoveLoc] = useState('');
  const [moveDrawer, setMoveDrawer] = useState('');
  const [drawers, setDrawers] = useState([]);
  const [error, setError] = useState('');
  const [findBusy, setFindBusy] = useState(false);
  const [findMsg, setFindMsg] = useState('');
  const [addChild, setAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [moveInto, setMoveInto] = useState(false);
  const [boxOptions, setBoxOptions] = useState([]);
  const [targetParent, setTargetParent] = useState('');

  const load = useCallback(() => {
    api(`/api/boxes/${id}`).then((b) => {
      setBox(b);
      setPosition(b.position || '');
      setMoveLoc(b.location_id ? String(b.location_id) : '');
      setMoveDrawer(b.drawer_id ? String(b.drawer_id) : '');
    }).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
    api('/api/locations').then(setLocations).catch(() => {});
    api('/api/settings').then(setSettings).catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!box || !highlightItem) return;
    const el = document.getElementById(`item-${highlightItem}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('item-flash');
    const t = setTimeout(() => el.classList.remove('item-flash'), 3000);
    return () => clearTimeout(t);
  }, [box, highlightItem]);

  useEffect(() => {
    if (moveLoc) {
      api(`/api/boxes/drawers/${moveLoc}`).then(setDrawers).catch(() => setDrawers([]));
    } else {
      setDrawers([]);
      setMoveDrawer('');
    }
  }, [moveLoc]);

  if (error) return <div className="center-page"><div className="alert alert-error">{error}</div></div>;
  if (!box) return <div className="center-page">Načítám…</div>;

  async function addItem(e) {
    e.preventDefault();
    if (!newItem.name.trim()) return;
    try {
      await api(`/api/boxes/${box.id}/items`, { method: 'POST', body: newItem });
      setNewItem({ name: '', quantity: 1, unit: '' });
      load();
    } catch (err) { setError(err.message); }
  }

  async function savePosition() {
    try {
      await api(`/api/boxes/${box.id}/position`, { method: 'POST', body: { position } });
      setPosPicker(false);
      load();
    } catch (err) { setError(err.message); }
  }

  async function moveBox() {
    try {
      await api(`/api/boxes/${box.id}/move`, {
        method: 'POST',
        body: {
          locationId: moveLoc ? Number(moveLoc) : null,
          drawerId: moveDrawer ? Number(moveDrawer) : null,
        },
      });
      load();
    } catch (err) { setError(err.message); }
  }

  async function confirmQty(n) {
    try {
      await api(`/api/items/${qtyDialog.itemId}/${qtyDialog.action}`, {
        method: 'POST',
        body: { quantity: n },
      });
      setQtyDialog(null);
      load();
    } catch (err) { setError(err.message); }
  }

  async function saveItem(e) {
    e.preventDefault();
    try {
      await api(`/api/items/${itemEditor.id}`, {
        method: 'PATCH',
        body: {
          name: itemEditor.name,
          quantity: itemEditor.quantity,
          unit: itemEditor.unit,
          alertThreshold: itemEditor.threshold === '' ? null : Number(itemEditor.threshold),
          alertEnabled: itemEditor.alertEnabled,
        },
      });
      setItemEditor(null);
      load();
    } catch (err) { setError(err.message); }
  }

  async function findBox() {
    setFindBusy(true);
    setFindMsg('');
    setError('');
    try {
      const r = await api(`/api/boxes/${box.id}/find`, { method: 'POST' });
      setFindMsg(`Světlo „${r.entity}“ (${r.location}) zablikalo — jdi tam!`);
    } catch (err) {
      setError(err.message);
    } finally {
      setFindBusy(false);
    }
  }

  async function deleteItem(id) {
    if (!window.confirm('Smazat položku?')) return;
    try {
      await api(`/api/items/${id}`, { method: 'DELETE' });
      load();
    } catch (err) { setError(err.message); }
  }

  async function deleteBox() {
    if (!window.confirm(`Smazat krabici "${box.name}" a všechny její položky? Tuto akci nelze vrátit.`)) return;
    try {
      await api(`/api/boxes/${box.id}`, { method: 'DELETE' });
      navigate('/boxes');
    } catch (err) { setError(err.message); }
  }

  async function downloadLabel() {
    try {
      await downloadFile(`/api/boxes/${box.id}/label.png`, `${box.id}-label.png`);
    } catch (err) { setError(err.message); }
  }

  async function downloadItemLabel(item) {
    try {
      await downloadFile(`/api/items/${item.id}/label.png`, `${item.name}-label.png`);
    } catch (err) { setError(err.message); }
  }

  async function addChildBox(e) {
    e.preventDefault();
    if (!newChildName.trim()) return;
    try {
      const created = await api('/api/boxes', { method: 'POST', body: { name: newChildName.trim(), parentId: box.id } });
      setAddChild(false);
      setNewChildName('');
      navigate(`/boxes/${created.id}`);
    } catch (err) { setError(err.message); }
  }

  async function openMoveInto() {
    setError('');
    try {
      const r = await api('/api/boxes?limit=100');
      setBoxOptions(r.items.filter((b) => b.id !== box.id));
      setTargetParent('');
      setMoveInto(true);
    } catch (err) { setError(err.message); }
  }

  async function confirmMoveInto() {
    try {
      await api(`/api/boxes/${box.id}/into`, {
        method: 'POST',
        body: { parentId: targetParent ? String(targetParent) : null },
      });
      setMoveInto(false);
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <Link to="/boxes" className="back-link"><ChevronLeft size={16} /> Krabice</Link>
      <div className="detail-head">
        <div>
          <h2>{box.name}</h2>
          {box.description && <p className="muted">{box.description}</p>}
          <div className="box-meta">
            {box.parent_id && <Link to={`/boxes/${box.parent_id}`} className="chip">Uvnitř: {box.parent_name || '…'}</Link>}
            {box.position && <span className="chip chip-lg">{box.position}</span>}
            <span className="muted small loc-tag"><Pin size={13} /> {box.location_name || 'bez lokace'}</span>
            {box.drawer_name && <span className="muted small loc-tag"> · {box.drawer_name}</span>}
          </div>
        </div>
        <div className="detail-actions">
          <button className="btn btn-primary" onClick={findBox} disabled={findBusy}>
            <Bulb size={16} /> {findBusy ? 'Blikám…' : 'Najít'}
          </button>
          <Link className="btn" to={`/boxes/${box.id}/edit`}><Edit size={16} /> Upravit</Link>
          <Link className="btn" to={`/print?box=${box.id}`}><Printer size={16} /> Štítek</Link>
          <button className="btn" onClick={downloadLabel}><Download size={16} /> Stáhnout PNG</button>
          <Link className="btn" to={`/print-ble/${box.id}`}><Bluetooth size={16} /> Vytisknout</Link>
          <button className="btn btn-icon btn-danger" onClick={deleteBox} aria-label="Smazat"><Trash size={17} /></button>
        </div>
      </div>
      {findMsg && <div className="alert alert-info">{findMsg}</div>}

      <div className="card">
        <h3>QR kód</h3>
        <QRLabel value={box.id} name={box.name} position={box.position} />
        <p className="muted small">ID: <code>{box.id}</code></p>
      </div>

      <div className="card">
        <h3>Fotky krabice</h3>
        <PhotoGallery photos={box.photos} boxId={box.id} onChanged={load} />
      </div>

      <div className="card">
        <div className="card-head-row">
          <h3>Krabice uvnitř</h3>
          <button className="btn btn-sm btn-primary" onClick={() => { setNewChildName(''); setAddChild(true); }}>
            Přidat krabici
          </button>
        </div>
        {box.children.length === 0 ? (
          <p className="muted">Žádné vnořené krabice. Vnitřní krabice může mít vlastní QR štítek, fotky i položky.</p>
        ) : (
          <div className="child-box-grid">
            {box.children.map((c) => (
              <Link key={c.id} to={`/boxes/${c.id}`} className="child-box-card">
                {c.photo && <img className="child-box-thumb" src={thumbUrl(c.photo)} alt="" loading="lazy" />}
                <div className="child-box-info">
                  <div className="strong">{c.name}</div>
                  <div className="muted small">
                    {c.position && <span className="chip">{c.position}</span>}{' '}
                    {c.item_count} položek
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        <button className="btn btn-sm" onClick={openMoveInto}>Přesunout tuto krabici do jiné…</button>
      </div>

      <div className="card">
        <h3>Pozice</h3>
        <div className="row">
          <span className="muted">Aktuální:</span>
          <span className="chip chip-lg">{box.position || '—'}</span>
        </div>
        {posPicker ? (
          <div className="row">
            <PositionPicker value={position} onChange={setPosition} />
            <button className="btn btn-primary" onClick={savePosition}>Uložit</button>
            <button className="btn" onClick={() => setPosPicker(false)}>Zrušit</button>
          </div>
        ) : (
          <button className="btn btn-sm" onClick={() => setPosPicker(true)}>Změnit pozici</button>
        )}
      </div>

      <div className="card">
        <h3>Lokace</h3>
        <div className="row">
          <select className="input" value={moveLoc} onChange={(e) => setMoveLoc(e.target.value)}>
            <option value="">— bez lokace —</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.type === 'skříň' ? ' (skříň)' : ''}</option>)}
          </select>
        </div>
        {drawers.length > 0 && (
          <div className="row" style={{ marginTop: 8 }}>
            <select className="input" value={moveDrawer} onChange={(e) => setMoveDrawer(e.target.value)}>
              <option value="">— bez šuplíku —</option>
              {drawers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn-primary" onClick={moveBox}>Přesunout</button>
        </div>
      </div>

      <div className="card">
        <h3>Obsah krabice</h3>
        {box.items.length === 0 ? (
          <p className="muted">Krabice je prázdná. Přidej první položku.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Položka</th><th>Množství</th><th></th></tr></thead>
            <tbody>
              {box.items.map((i) => (
                <tr key={i.id} id={`item-${i.id}`}>
                  <td>
                    {i.photos?.[0] && <img className="item-thumb" src={thumbUrl(i.photos[0].filename)} alt="" loading="lazy" />}
                    <span className="strong">{i.name}</span>
                    {i.alert_threshold != null && <span className="badge b-warn">≤ {fmtQty(i.alert_threshold)}</span>}
                  </td>
                  <td>{fmtQty(i.quantity)} {i.unit}</td>
                  <td className="row-actions">
                    <button className="btn btn-sm btn-plus" onClick={() => setQtyDialog({ itemId: i.id, action: 'add', item: i.name })}>+</button>
                    <button className="btn btn-sm btn-minus" onClick={() => setQtyDialog({ itemId: i.id, action: 'remove', item: i.name })}>−</button>
                    <button className="btn btn-sm" onClick={() => setItemEditor({ id: i.id, name: i.name, quantity: i.quantity, unit: i.unit, threshold: i.alert_threshold ?? '', alertEnabled: i.alert_enabled !== 0, photos: i.photos || [] })} aria-label="Upravit položku"><Edit size={15} /></button>
                    {settings?.labels?.showItemQr !== false && (
                      <button className="btn btn-sm" onClick={() => downloadItemLabel(i)} aria-label={`QR štítek položky ${i.name}`} title="QR štítek položky"><QrCode size={15} /></button>
                    )}
                    <button className="btn btn-sm btn-danger" onClick={() => deleteItem(i.id)} aria-label="Smazat položku"><Trash size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form onSubmit={addItem} className="add-item-form">
          <input className="input" placeholder="Název položky" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
          <input className="input qty-input" type="number" step="any" min="0" placeholder="Ks" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} />
          <input className="input unit-input" placeholder="Jednotka" value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} />
          <button className="btn btn-primary" type="submit">Přidat</button>
        </form>
      </div>

      <div className="card">
        <h3>Historie</h3>
        {box.movements.length === 0 ? (
          <p className="muted">Žádné pohyby.</p>
        ) : (
          <ul className="activity">
            {box.movements.map((m) => (
              <li key={m.id}>
                <span className="badge">{m.action_label}</span>
                <span className="muted detail">{fmtMovement(m)}</span>
                <span className="muted time">{fmtDate(m.created_at)} · {m.username || '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <QuantityDialog
        open={!!qtyDialog}
        title={qtyDialog?.action === 'add' ? `Přidat: ${qtyDialog?.item}` : `Vydat: ${qtyDialog?.item}`}
        onClose={() => setQtyDialog(null)}
        onConfirm={confirmQty}
      />

      <Modal open={addChild} title={`Nová krabice uvnitř „${box.name}“`} onClose={() => setAddChild(false)}>
        <form onSubmit={addChildBox} className="modal-form">
          <label className="label">Název krabice</label>
          <input
            className="input"
            placeholder="Např. Šroubky M6"
            value={newChildName}
            onChange={(e) => setNewChildName(e.target.value)}
            autoFocus
          />
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setAddChild(false)}>Zrušit</button>
            <button type="submit" className="btn btn-primary" disabled={!newChildName.trim()}>Vytvořit</button>
          </div>
        </form>
      </Modal>

      <Modal open={moveInto} title={`Přesunout „${box.name}“ do krabice`} onClose={() => setMoveInto(false)}>
        <div className="modal-form">
          <label className="label">Cílová krabice (prázdné = vyndat na úroveň)</label>
          <select className="input" value={targetParent} onChange={(e) => setTargetParent(e.target.value)}>
            <option value="">— na úroveň (bez nadřazené krabice) —</option>
            {boxOptions.map((b) => (
              <option key={b.id} value={b.id}>{b.name}{b.parent_name ? ` (uvnitř ${b.parent_name})` : ''}</option>
            ))}
          </select>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setMoveInto(false)}>Zrušit</button>
            <button className="btn btn-primary" onClick={confirmMoveInto}>Přesunout</button>
          </div>
        </div>
      </Modal>

      <Modal open={itemEditor !== null} title="Upravit položku" onClose={() => setItemEditor(null)}>
        <form onSubmit={saveItem} className="modal-form">
          <input className="input" placeholder="Název" value={itemEditor?.name || ''} onChange={(e) => setItemEditor({ ...itemEditor, name: e.target.value })} />
          <div className="row">
            <input className="input" type="number" step="any" min="0" placeholder="Množství" value={itemEditor?.quantity} onChange={(e) => setItemEditor({ ...itemEditor, quantity: e.target.value })} />
            <input className="input" placeholder="Jednotka" value={itemEditor?.unit || ''} onChange={(e) => setItemEditor({ ...itemEditor, unit: e.target.value })} />
          </div>
          <label className="label-inline" style={{ margin: '10px 0' }}>
            <input
              type="checkbox"
              checked={!!itemEditor?.alertEnabled}
              onChange={(e) => setItemEditor({ ...itemEditor, alertEnabled: e.target.checked })}
            />
            Upozorňovat na nízký stav (Telegram)
          </label>
          <label className="label">Upozornit při nízkém stavu (nechat prázdné = vypnuto)</label>
          <input className="input" type="number" step="any" min="0" placeholder="Např. 5 — upozorní na Telegram" value={itemEditor?.threshold ?? ''} onChange={(e) => setItemEditor({ ...itemEditor, threshold: e.target.value })} />
          <label className="label">Fotky položky</label>
          <PhotoGallery
            photos={(box.items.find((it) => it.id === itemEditor?.id)?.photos) || []}
            itemId={itemEditor?.id}
            onChanged={load}
          />
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setItemEditor(null)}>Zrušit</button>
            <button type="submit" className="btn btn-primary">Uložit</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function fmtMovement(m) {
  const d = m.detail || {};
  if (m.action === 'quantity_added') return `${d.item} +${fmtQty(d.quantity)} ${d.unit || ''}`.trim();
  if (m.action === 'quantity_removed') return `${d.item} −${fmtQty(d.quantity)} ${d.unit || ''}`.trim();
  if (m.action === 'item_added') return `${d.item} (${fmtQty(d.quantity)} ${d.unit || ''})`.trim();
  if (m.action === 'position_changed') return `${d.from || '—'} → ${d.to || '—'}`;
  if (m.action === 'moved' && d.into !== undefined) return `do krabice: ${d.from || '—'} → ${d.into}`;
  if (m.action === 'moved') return `${d.from} → ${d.to}`;
  if (m.action === 'updated' && Array.isArray(d.changes)) return d.changes.join(', ');
  return '';
}
