import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate, fmtQty } from '../api';
import { Boxes, Clipboard, Pin, Users, Plus, Scan, Printer, Download } from '../components/Icons';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api('/api/stats').then(setStats).catch(() => {});
  }, []);

  if (!stats) return <div className="center-page">Načítám…</div>;

  const today = new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Přehled</h2>
          <div className="page-sub">{today}</div>
        </div>
      </div>

      <div className="quick-actions">
        <Link to="/boxes/new" className="qa">
          <span className="qa-icon q1"><Plus size={20} /></span>
          <span>Nová krabice</span>
        </Link>
        <Link to="/scan" className="qa">
          <span className="qa-icon q2"><Scan size={20} /></span>
          <span>Skenovat QR</span>
        </Link>
        <Link to="/print" className="qa">
          <span className="qa-icon q3"><Printer size={20} /></span>
          <span>Tisknout štítky</span>
        </Link>
        <Link to="/export" className="qa">
          <span className="qa-icon q4"><Download size={20} /></span>
          <span>Export</span>
        </Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon i1"><Boxes size={22} /></span>
          <div className="stat-body"><div className="stat-num">{stats.boxes}</div><div className="stat-label">Krabice</div></div>
        </div>
        <div className="stat-card">
          <span className="stat-icon i2"><Clipboard size={22} /></span>
          <div className="stat-body"><div className="stat-num">{fmtQty(stats.itemTotal)}</div><div className="stat-label">Kusů</div></div>
        </div>
        <div className="stat-card">
          <span className="stat-icon i3"><Pin size={22} /></span>
          <div className="stat-body"><div className="stat-num">{stats.locations}</div><div className="stat-label">Lokace</div></div>
        </div>
        <div className="stat-card">
          <span className="stat-icon i4"><Users size={22} /></span>
          <div className="stat-body"><div className="stat-num">{stats.users}</div><div className="stat-label">Uživatelé</div></div>
        </div>
      </div>

      {stats.byPosition.length > 0 && (
        <div className="card">
          <h3>Pozice</h3>
          <div className="chip-row">
            {stats.byPosition.slice(0, 12).map((p) => (
              <Link key={p.position} to={`/boxes?position=${p.position}`} className="chip">
                {p.position} <span className="chip-count">{p.c}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3>Poslední pohyby</h3>
        {stats.recent.length === 0 ? (
          <p className="muted">Zatím žádná aktivita. <Link to="/boxes/new">Vytvoř první krabici →</Link></p>
        ) : (
          <ul className="activity">
            {stats.recent.map((m) => (
              <li key={m.id}>
                <span className={`badge ${badgeTone(m.action)}`}>{m.action_label}</span>
                {m.box_name ? <Link to={`/boxes/${m.box_id}`} className="strong">{m.box_name}</Link> : <span className="muted">smazaná krabice</span>}
                <span className="muted detail">{fmtDetail(m)}</span>
                <span className="muted time">{fmtDate(m.created_at)} · {m.username || '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function badgeTone(action) {
  if (action === 'quantity_added' || action === 'created' || action === 'item_added') return 'b-ok';
  if (action === 'quantity_removed') return 'b-danger';
  return '';
}

function fmtDetail(m) {
  const d = m.detail || {};
  if (m.action === 'quantity_added' || m.action === 'quantity_removed') {
    return `${d.item} +${fmtQty(d.quantity)} ${d.unit || ''}`.trim();
  }
  if (m.action === 'position_changed') return `${d.from || '—'} → ${d.to || '—'}`;
  if (m.action === 'moved') return `${d.from} → ${d.to}`;
  if (m.action === 'created') return d.position ? `pozice ${d.position}` : '';
  if (m.action === 'item_added') return `${d.item} (${fmtQty(d.quantity)} ${d.unit || ''})`.trim();
  if (m.action === 'updated' && Array.isArray(d.changes)) return d.changes.join(', ');
  return '';
}
