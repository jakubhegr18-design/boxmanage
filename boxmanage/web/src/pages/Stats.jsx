import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate, fmtQty } from '../api';
import { Boxes, Clipboard, Pin, Users, History, Chart } from '../components/Icons';

const SECTION_LABELS = { drawer: 'šuplíky', shelf: 'poličky', cabinet: 'skříně' };

export default function Stats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api('/api/stats').then(setStats).catch(() => {});
  }, []);

  if (!stats) return <div className="center-page">Načítám…</div>;

  const months = fillMonths(stats.monthly || []);
  const max = Math.max(1, ...months.map((m) => m.c));

  return (
    <div>
      <h2>Statistiky</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon i1"><Boxes size={22} /></span>
          <div className="stat-body"><div className="stat-num">{stats.boxes}</div><div className="stat-label">Krabice</div></div>
        </div>
        <div className="stat-card">
          <span className="stat-icon i2"><Clipboard size={22} /></span>
          <div className="stat-body"><div className="stat-num">{stats.items}</div><div className="stat-label">Položek</div></div>
        </div>
        <div className="stat-card">
          <span className="stat-icon i2"><Clipboard size={22} /></span>
          <div className="stat-body"><div className="stat-num">{fmtQty(stats.itemTotal)}</div><div className="stat-label">Kusů</div></div>
        </div>
        <div className="stat-card">
          <span className="stat-icon i1"><Pin size={22} /></span>
          <div className="stat-body"><div className="stat-num">{stats.locations}</div><div className="stat-label">Lokace</div></div>
        </div>
        <div className="stat-card">
          <span className="stat-icon i4"><History size={22} /></span>
          <div className="stat-body"><div className="stat-num">{stats.movements}</div><div className="stat-label">Pohybů</div></div>
        </div>
        <div className="stat-card">
          <span className="stat-icon i3"><Users size={22} /></span>
          <div className="stat-body"><div className="stat-num">{stats.users}</div><div className="stat-label">Uživatelé</div></div>
        </div>
      </div>

      <div className="card">
        <h3><Chart size={16} /> Aktivita za posledních 12 měsíců</h3>
        {months.every((m) => m.c === 0) ? (
          <p className="muted">Zatím žádné pohyby.</p>
        ) : (
          <div className="bar-chart">
            {months.map((m) => (
              <div key={m.ym} className="bar-col" title={`${m.ym}: ${m.c} pohybů`}>
                <div className="bar-val">{m.c > 0 ? m.c : ''}</div>
                <div className="bar" style={{ height: m.c === 0 ? 2 : Math.max(3, Math.round((m.c / max) * 120)) }} />
                <div className="bar-label">{m.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {stats.topLocations?.length > 0 && (
        <div className="card">
          <h3>Nejvytíženější lokace</h3>
          {stats.topLocations.map((l, i) => (
            <div key={l.name} className="rank-row">
              <span className="rank">{i + 1}</span>
              <Link to={`/boxes?location=${l.id}`} className="strong">{l.name}</Link>
              <span className="muted detail">{l.c} krabic</span>
            </div>
          ))}
        </div>
      )}

      {stats.bySection?.length > 0 && (
        <div className="card">
          <h3>Sekce</h3>
          <div className="chip-row">
            {stats.bySection.map((s) => (
              <Link key={s.section} to={`/boxes?section=${s.section}`} className="chip">
                {SECTION_LABELS[s.section] || s.section} <span className="chip-count">{s.c}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3>Poslední pohyby</h3>
        {stats.recent.length === 0 ? (
          <p className="muted">Zatím žádná aktivita.</p>
        ) : (
          <ul className="activity">
            {stats.recent.slice(0, 15).map((m) => (
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

function fillMonths(monthly) {
  const map = new Map(monthly.map((m) => [m.ym, Number(m.c)]));
  const out = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ ym, c: map.get(ym) || 0, label: d.toLocaleDateString('cs-CZ', { month: 'short' }) });
  }
  return out;
}

function badgeTone(action) {
  if (action === 'quantity_added' || action === 'created' || action === 'item_added') return 'b-ok';
  if (action === 'quantity_removed') return 'b-danger';
  return '';
}

function fmtDetail(m) {
  const d = m.detail || {};
  if (m.action === 'quantity_added') return `${d.item} +${fmtQty(d.quantity)} ${d.unit || ''}`.trim();
  if (m.action === 'quantity_removed') return `${d.item} −${fmtQty(d.quantity)} ${d.unit || ''}`.trim();
  if (m.action === 'position_changed') return `${d.from || '—'} → ${d.to || '—'}`;
  if (m.action === 'moved') return `${d.from} → ${d.to}`;
  if (m.action === 'created') return d.position ? `pozice ${d.position}` : '';
  if (m.action === 'item_added') return `${d.item} (${fmtQty(d.quantity)} ${d.unit || ''})`.trim();
  if (m.action === 'updated' && Array.isArray(d.changes)) return d.changes.join(', ');
  return '';
}
