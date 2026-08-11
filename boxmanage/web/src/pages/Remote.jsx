import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { api, fmtDate, fmtQty } from '../api';

function remoteUrl() {
  const host = window.location.hostname || 'localhost';
  return `http://${host}:8092`;
}

export default function Remote() {
  const url = remoteUrl();
  const [qr, setQr] = useState('');
  const [recent, setRecent] = useState([]);
  const [newIds, setNewIds] = useState(new Set());
  const [lastUpdate, setLastUpdate] = useState('');
  const lastIds = useRef(new Set());
  const first = useRef(true);

  useEffect(() => {
    QRCode.toDataURL(`bm://remote?url=${url}`, {
      width: 260,
      margin: 2,
      color: { dark: '#1f2937', light: '#ffffff' },
    }).then(setQr).catch(() => {});
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    let timer;
    async function poll() {
      try {
        const stats = await api('/api/stats');
        if (cancelled) return;
        const list = stats.recent || [];
        const current = new Set(list.map((m) => m.id));
        const added = [...current].filter((id) => !lastIds.current.has(id));
        setRecent(list);
        setLastUpdate(new Date().toLocaleTimeString('cs-CZ'));
        if (!first.current && added.length) {
          setNewIds(new Set(added));
          setTimeout(() => { if (!cancelled) setNewIds(new Set()); }, 6000);
        }
        first.current = false;
        lastIds.current = current;
      } catch { /* ignore */ }
      timer = setTimeout(poll, 2000);
    }
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  return (
    <div>
      <h2>Dálkový skener</h2>
      <div className="card">
        <h3>1. Naskenuj QR mobilem</h3>
        <p className="muted">
          QR kód obsahuje adresu serveru. Otevři mobilní aplikaci, přejdi do <strong>Sken</strong>,
          namiř kameru na tento QR — aplikace se připojí k serveru a zapne dálkový režim.
        </p>
        <div className="qr-display">
          {qr ? <img src={qr} alt="Párovací QR kód" /> : <p className="muted">Generuji QR…</p>}
        </div>
        <p className="muted small center">Adresa: <code>{url}</code></p>
      </div>

      <div className="card">
        <h3>2. Aktivita ze skenování</h3>
        <p className="muted">
          Naskenované krabice a změny z mobilu se tu objevují živě (obnova každé 2 s).
          Kliknutím na krabici ji otevřeš a můžeš doupravit.
        </p>
        {recent.length === 0 ? (
          <p className="muted">Zatím žádné pohyby.</p>
        ) : (
          <ul className="activity">
            {recent.map((m) => (
              <li key={m.id} className={newIds.has(m.id) ? 'new' : ''}>
                <span className="badge">{m.action_label}</span>
                <Link to={`/boxes/${encodeURIComponent(m.box_id)}`} className="strong">{m.box_name || m.box_id}</Link>
                {fmt(m) && <span className="muted detail">{fmt(m)}</span>}
                <span className="muted time">{fmtDate(m.created_at)} · {m.username || '—'}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">Aktualizováno: {lastUpdate}</p>
      </div>
    </div>
  );
}

function fmt(m) {
  const d = m.detail || {};
  switch (m.action) {
    case 'quantity_added': return `${d.item} +${fmtQty(d.quantity)} ${d.unit || ''}`.trim();
    case 'quantity_removed': return `${d.item} −${fmtQty(d.quantity)} ${d.unit || ''}`.trim();
    case 'item_added': return `${d.item} (${fmtQty(d.quantity)} ${d.unit || ''})`.trim();
    case 'position_changed': return `${d.from || '—'} → ${d.to || '—'}`;
    case 'moved': return `${d.from} → ${d.to}`;
    case 'updated': return Array.isArray(d.changes) ? d.changes.join(', ') : '';
    default: return '';
  }
}
