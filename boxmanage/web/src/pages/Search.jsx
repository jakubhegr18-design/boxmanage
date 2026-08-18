import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtQty } from '../api';
import { Search, Boxes, Clipboard, Pin } from '../components/Icons';

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [boxes, setBoxes] = useState([]);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (!query) { setBoxes([]); setItems([]); return; }
    setBusy(true);
    const t = setTimeout(() => {
      Promise.all([
        api('/api/boxes?search=' + encodeURIComponent(query) + '&limit=20'),
        api('/api/items?q=' + encodeURIComponent(query) + '&limit=50'),
      ]).then(([b, it]) => {
        setBoxes(b.items);
        setItems(it.items);
      }).catch(() => {}).finally(() => setBusy(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const searching = q.trim().length > 0;

  return (
    <div>
      <h2>Hledání</h2>
      <div className="search-wrap">
        <span className="search-ico"><Search size={17} /></span>
        <input
          className="input"
          placeholder="Hledat položky i krabice…"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {busy && <p className="muted">Hledám…</p>}

      {searching && !busy && items.length === 0 && boxes.length === 0 && (
        <div className="card"><p className="muted">Nic nenalezeno.</p></div>
      )}

      {searching && !busy && items.length > 0 && (
        <div className="card">
          <h3 className="search-heading"><Clipboard size={16} /> Položky ({items.length})</h3>
          <ul className="activity">
            {items.map((it) => (
              <li key={it.id}>
                <Link to={`/boxes/${encodeURIComponent(it.box_id)}?item=${it.id}`} className="strong">
                  {it.name}
                </Link>
                <span className="muted detail">
                  {fmtQty(it.quantity)} {it.unit || ''}
                </span>
                <span className="muted detail">
                  {it.box_name}
                  {it.box_position && ` · ${it.box_position}`}
                  {it.location_name && <span className="loc-tag"><Pin size={11} /> {it.location_name}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {searching && !busy && boxes.length > 0 && (
        <div className="card">
          <h3 className="search-heading"><Boxes size={16} /> Krabice ({boxes.length})</h3>
          <ul className="activity">
            {boxes.map((b) => (
              <li key={b.id}>
                <Link to={`/boxes/${encodeURIComponent(b.id)}`} className="strong">{b.name}</Link>
                <span className="muted detail">
                  {b.position && `pozice ${b.position}`}
                  {b.location_name && <span className="loc-tag"><Pin size={11} /> {b.location_name}</span>}
                </span>
                <span className="muted time">{b.item_count} položek</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
