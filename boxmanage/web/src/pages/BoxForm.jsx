import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import PositionPicker from '../components/PositionPicker';

export default function BoxForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // ID požadované z naskenovaného QR štítku (Scan.jsx přesměruje na /boxes/new?from=...).
  const fromId = isEdit ? '' : (searchParams.get('from') || '').trim();
  const [form, setForm] = useState({ name: '', description: '', position: '', locationId: '' });
  const [customId, setCustomId] = useState(fromId);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/locations').then(setLocations).catch(() => {});
    if (isEdit) {
      api(`/api/boxes/${id}`).then((b) => {
        setForm({ name: b.name, description: b.description || '', position: b.position || '', locationId: b.location_id ? String(b.location_id) : '' });
      }).catch((e) => setError(e.message));
    }
  }, [id, isEdit]);

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
      };
      if (isEdit) {
        const box = await api(`/api/boxes/${id}`, { method: 'PATCH', body });
        navigate(`/boxes/${box.id}`);
      } else {
        // Po naskenování neznámého QR nebo ručně zadané ID: krabice dostane stejné ID jako na starém štítku.
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
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>

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
