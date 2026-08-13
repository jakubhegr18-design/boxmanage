import { useState } from 'react';
import { api, photoUrl, thumbUrl } from '../api';
import { Trash, Camera, Plus } from './Icons';

// Galerie fotek krabice nebo položky. Podle prop boxId/itemId volá správné API.
export default function PhotoGallery({ photos = [], boxId, itemId, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const uploadEndpoint = boxId ? `/api/boxes/${boxId}/photos` : `/api/items/${itemId}/photos`;
  const deleteEndpoint = boxId ? `/api/box-photos` : `/api/item-photos`;

  async function upload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('photos', f));
      await api(uploadEndpoint, { method: 'POST', body: fd });
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function remove(ph) {
    if (!window.confirm('Smazat fotku?')) return;
    try {
      await api(`${deleteEndpoint}/${ph.id}`, { method: 'DELETE' });
      onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="photo-gallery">
      {photos.map((ph) => (
        <div key={ph.id} className="photo-item">
          <a href={photoUrl(ph.filename)} target="_blank" rel="noreferrer">
            <img src={thumbUrl(ph.filename)} alt={ph.caption || 'Fotka'} loading="lazy" />
          </a>
          <button className="photo-del" onClick={() => remove(ph)} aria-label="Smazat fotku"><Trash size={13} /></button>
        </div>
      ))}
      <label className="photo-add">
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          disabled={busy}
          onChange={upload}
        />
        <span>{busy ? 'Nahrávám…' : <><Plus size={16} /> <Camera size={16} /></>}</span>
      </label>
      {error && <div className="alert alert-error small-photo-err">{error}</div>}
    </div>
  );
}
