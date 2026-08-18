import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, fmtDate, thumbUrl } from '../api';
import { Pin, Search } from '../components/Icons';

export default function Boxes() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const [locations, setLocations] = useState([]);
  const [filterLoc, setFilterLoc] = useState(params.get('location') || '');
  const [filterDrawer, setFilterDrawer] = useState(params.get('drawer') || '');
  const [filterPos, setFilterPos] = useState(params.get('position') || '');
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    api('/api/locations').then(setLocations).catch(() => {});
    api('/api/boxes?limit=100').then((d) => {
      const set = [...new Set(d.items.map((b) => b.position).filter(Boolean))].sort();
      setPositions(set);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    // Do API se posílá parametr "search" — backend ho čte v req.query.search (routes/boxes.js).
    if (search.trim()) qs.set('search', search.trim());
    if (filterLoc) qs.set('location', filterLoc);
    if (filterDrawer) qs.set('drawer', filterDrawer);
    if (filterPos) qs.set('position', filterPos);
    qs.set('page', page);
    api(`/api/boxes?${qs}`).then(setData).catch(() => {});
  }, [search, filterLoc, filterPos, page]);

  useEffect(() => {
    // Adresní řádek používá parametr "q" (záměrně jiný než "search" do API) kvůli
    // zpětné kompatibilitě s dříve uloženými/sdílenými odkazy (/boxes?q=...).
    const p = new URLSearchParams();
    if (search.trim()) p.set('q', search.trim());
    if (filterLoc) p.set('location', filterLoc);
    if (filterDrawer) p.set('drawer', filterDrawer);
    if (filterPos) p.set('position', filterPos);
    setParams(p, { replace: true });
  }, [search, filterLoc, filterDrawer, filterPos]);

  if (!data) return <div className="center-page">Načítám…</div>;

  return (
    <div>
      <h2>Krabice <span className="muted">({data.total})</span></h2>

      <div className="search-wrap">
        <span className="search-ico"><Search size={17} /></span>
        <input
          className="input"
          placeholder="Hledat podle názvu, pozice, ID…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className="filter-row">
        <select className="input" value={filterLoc} onChange={(e) => { setFilterLoc(e.target.value); setPage(1); }}>
          <option value="">Všechny lokace</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select className="input" value={filterPos} onChange={(e) => { setFilterPos(e.target.value); setPage(1); }}>
          <option value="">Všechny pozice</option>
          {positions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {data.items.length === 0 ? (
        <div className="card"><p className="muted">Žádné krabice. <Link to="/boxes/new">Vytvoř novou →</Link></p></div>
      ) : (
        <div className="box-list">
          {data.items.map((b) => (
            <Link key={b.id} to={`/boxes/${b.id}`} className="box-card">
              {b.photo && <img className="box-card-thumb" src={thumbUrl(b.photo)} alt="" loading="lazy" />}
              <div className="box-main">
                <div className="box-name">{b.name}</div>
                {b.description && <div className="muted small truncate">{b.description}</div>}
                <div className="box-meta">
                  {b.parent_name && <Link to={`/boxes/${b.parent_id}`} className="chip">uvnitř {b.parent_name}</Link>}
                  {b.position && <span className="chip">{b.position}</span>}
                  {b.location_name && <span className="muted small loc-tag"><Pin size={12} /> {b.location_name}{b.drawer_name ? ` › ${b.drawer_name}` : ''}</span>}
                </div>
              </div>
              <div className="box-side">
                <span className="badge">{b.item_count} pol.</span>
                <span className="muted small">{fmtDate(b.updated_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {data.pages > 1 && (
        <div className="pager">
          <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button>
          <span>strana {page} / {data.pages}</span>
          <button className="btn" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>→</button>
        </div>
      )}
    </div>
  );
}
