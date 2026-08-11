import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api, fmtDate, fmtQty } from '../api';
import QRLabel from '../components/QRLabel';
import PositionPicker from '../components/PositionPicker';
import QuantityDialog from '../components/QuantityDialog';
import Modal from '../components/Modal';
import { ChevronLeft, Pin, Edit, Printer, Trash } from '../components/Icons';

export default function BoxDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [box, setBox] = useState(null);
  const [locations, setLocations] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', quantity: 1, unit: '' });
  const [qtyDialog, setQtyDialog] = useState(null);
  const [itemEditor, setItemEditor] = useState(null);
  const [posPicker, setPosPicker] = useState(false);
  const [position, setPosition] = useState('');
  const [moveLoc, setMoveLoc] = useState('');
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const load = useCallback(() => {
    api(`/api/boxes/${id}`).then((b) => {
      setBox(b);
      setPosition(b.position || '');
      setMoveLoc(b.location_id ? String(b.location_id) : '');
    }).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
    api('/api/locations').then(setLocations).catch(() => {});
  }, [load]);

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
      await api(`/api/boxes/${box.id}/move`, { method: 'POST', body: { locationId: moveLoc ? Number(moveLoc) : null } });
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
        body: { name: itemEditor.name, quantity: itemEditor.quantity, unit: itemEditor.unit },
      });
      setItemEditor(null);
      load();
    } catch (err) { setError(err.message); }
  }

  async function deleteItem(id) {
    if (!window.confirm('Smazat položku?')) return;
    try {
      await api(`/api/items/${id}`, { method: 'DELETE' });
      load();
    } catch (err) { setError(err.message); }
  }

  async function deleteBox() {
    try {
      await api(`/api/boxes/${box.id}`, { method: 'DELETE' });
      navigate('/boxes');
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
            {box.position && <span className="chip chip-lg">{box.position}</span>}
            <span className="muted small loc-tag"><Pin size={13} /> {box.location_name || 'bez lokace'}</span>
          </div>
        </div>
        <div className="detail-actions">
          <Link className="btn" to={`/boxes/${box.id}/edit`}><Edit size={16} /> Upravit</Link>
          <Link className="btn" to={`/print?box=${box.id}`}><Printer size={16} /> Štítek</Link>
          <button className="btn btn-icon btn-danger" onClick={() => setConfirmDel(true)} aria-label="Smazat"><Trash size={17} /></button>
        </div>
      </div>

      <div className="card">
        <h3>QR kód</h3>
        <QRLabel value={box.id} name={box.name} position={box.position} />
        <p className="muted small">ID: <code>{box.id}</code></p>
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
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
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
                <tr key={i.id}>
                  <td className="strong">{i.name}</td>
                  <td>{fmtQty(i.quantity)} {i.unit}</td>
                  <td className="row-actions">
                    <button className="btn btn-sm btn-plus" onClick={() => setQtyDialog({ itemId: i.id, action: 'add', item: i.name })}>+</button>
                    <button className="btn btn-sm btn-minus" onClick={() => setQtyDialog({ itemId: i.id, action: 'remove', item: i.name })}>−</button>
                    <button className="btn btn-sm" onClick={() => setItemEditor({ id: i.id, name: i.name, quantity: i.quantity, unit: i.unit })} aria-label="Upravit položku"><Edit size={15} /></button>
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

      <Modal open={!!itemEditor} title="Upravit položku" onClose={() => setItemEditor(null)}>
        <form onSubmit={saveItem} className="modal-form">
          <input className="input" placeholder="Název" value={itemEditor?.name || ''} onChange={(e) => setItemEditor({ ...itemEditor, name: e.target.value })} />
          <div className="row">
            <input className="input" type="number" step="any" min="0" placeholder="Množství" value={itemEditor?.quantity} onChange={(e) => setItemEditor({ ...itemEditor, quantity: e.target.value })} />
            <input className="input" placeholder="Jednotka" value={itemEditor?.unit || ''} onChange={(e) => setItemEditor({ ...itemEditor, unit: e.target.value })} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setItemEditor(null)}>Zrušit</button>
            <button type="submit" className="btn btn-primary">Uložit</button>
          </div>
        </form>
      </Modal>

      <Modal open={confirmDel} title="Smazat krabici?" onClose={() => setConfirmDel(false)}>
        <p>Krabice <strong>{box.name}</strong> a všechny její položky budou smazány. Tuto akci nelze vrátit.</p>
        <div className="modal-actions">
          <button className="btn" onClick={() => setConfirmDel(false)}>Zrušit</button>
          <button className="btn btn-danger" onClick={deleteBox}>Smazat</button>
        </div>
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
  if (m.action === 'moved') return `${d.from} → ${d.to}`;
  if (m.action === 'updated' && Array.isArray(d.changes)) return d.changes.join(', ');
  return '';
}
