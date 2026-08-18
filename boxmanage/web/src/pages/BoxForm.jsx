import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import PositionPicker from '../components/PositionPicker';

export default function BoxForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromId = isEdit ? '' : (searchParams.get('from') || '').trim();
  const [form, setForm] = useState({ name: '', description: '', position: '', locationId: '', drawerId: '' });
  const [customId, setCustomId] = useState(fromId);
  const [locations, setLocations] = useState([]);
  const [drawers, setDrawers] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/locations').then(setLocations).catch(() => {});
    if (isEdit) {
      api(`/api/boxes/${id}`).then((b) => {
        setForm({
          name: b.name,
          description: b.description || '',
          position: b.position || '',
          locationId: b.location_id ? String(b.location_id) : '',
          drawerId: b.drawer_id ? String(b.drawer_id) : '',
        });
      }).catch((e) => setError(e.message));
    }
  }, [id, isEdit]);

  useEffect(() => {
    if (form.locationId) {
      api(`/api/boxes/drawers/${form.locationId}`).then((d) => {
        setDrawers(d);
        if (form.drawerId && !d.find((x) => String(x.id) === form.drawerId)) {
          setForm((f) => ({ ...f, drawerId: '' }));
        }
      }).catch(() => setDrawers([]));
    } else {
      setDrawers([]);
      if (form.drawerId) setForm((f) => ({ ...f, drawerId: '' }));
    }
  }, [form.locationId]);

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Název je povinný');
    setBusy(true);
    setError('');
    try {
      const body = {
        name: form.name,
        description: form.description,
        position: form.position,
        locationId: form.locationId ? Number(form.locationId) : null,
        drawerId: form.drawerId ? Number(form.drawerId) : null,
      };
      if (isEdit) {
        const box = await api(`/api/boxes/${id}`, { method: 'PATCH', body });
        navigate(`/boxes/${box.id}`);
      } else {
        const requestedId = customId.trim();
        if (requestedId) body.id = requestedId;
        const box = await api('/api/boxes', { method: 'POST', body });
        navigate(`/boxes/${box.id}`);
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div>
      <Link to={isEdit ? `/boxes/${id}` : '/boxes'} className="back-link">← Zpět</Link>
      <h2>{isEdit ? 'Upravit krabici' : 'Nová krabice'}</h2>

      {fromId && (
        <div className="alert alert-info">
          Nová krabice dostane ID z naskenovaného štítku: <code>{fromId}</code>
        </div>
      )}

      <form onSubmit={submit} className="card form">
        <label className="label">Název *</label>
        <input className="input" placeholder="např. Šrouby M6" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />

        {!isEdit && (
          <>
            <label className="label">ID krabice (QR kód) — volitelné</label>
            <input
              className="input"
              placeholder={fromId ? fromId : "např. ZZ-300987716"}
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
            />
            <p className="hint">Zadej ID ze starého štítku, aby stávající QR kód fungoval i tady. Povolené jsou písmena, číslice, tečka, podtržítko a pomlčka (max 100 znaků). Prázdné = vygeneruje se nové ID.</p>
          </>
        )}

        <label className="label">Popis</label>
        <textarea className="input" rows={3} placeholder="Co v krabici je…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

        <label className="label">Pozice (např. A1, B2, C3)</label>
        <PositionPicker value={form.position} onChange={(position) => setForm({ ...form, position })} />

        <label className="label">Lokace</label>
        <select className="input" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
          <option value="">— bez lokace —</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.type === 'skříň' ? ' (skříň)' : ''}</option>)}
        </select>

        {drawers.length > 0 && (
          <>
            <label className="label">Šuplík</label>
            <select className="input" value={form.drawerId} onChange={(e) => setForm({ ...form, drawerId: e.target.value })}>
              <option value="">— bez šuplíku —</option>
              {drawers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <div className="modal-actions">
          <Link className="btn" to={isEdit ? `/boxes/${id}` : '/boxes'}>Zrušit</Link>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Ukládám…' : isEdit ? 'Uložit změny' : 'Vytvořit krabici'}
          </button>
        </div>
      </form>
    </div>
  );
}
