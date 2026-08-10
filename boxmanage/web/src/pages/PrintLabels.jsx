import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import QRLabel from '../components/QRLabel';
import { Printer } from '../components/Icons';

export default function PrintLabels() {
  const [params] = useSearchParams();
  const [all, setAll] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [copies, setCopies] = useState(1);
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(4);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newPos, setNewPos] = useState('');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    api('/api/boxes?limit=100&search=' + encodeURIComponent(search)).then((d) => setAll(d.items)).catch(() => {});
  }, [search]);

  useEffect(() => {
    const boxId = params.get('box');
    if (boxId && !selected.includes(boxId)) setSelected([...selected, boxId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function toggle(id) {
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  async function addNew() {
    if (!newName.trim()) return;
    try {
      const box = await api('/api/boxes', {
        method: 'POST',
        body: { name: newName.trim(), position: newPos, locationId: null },
      });
      setNewName('');
      setNewPos('');
      setSelected([...selected, box.id]);
      setAll((prev) => [box, ...prev]);
    } catch (e) { setError(e.message); }
  }

  const chosen = useMemo(() => all.filter((b) => selected.includes(b.id)), [all, selected]);

  const labels = useMemo(() => {
    const out = [];
    for (const b of chosen) {
      for (let i = 0; i < copies; i++) out.push(b);
    }
    return out;
  }, [chosen, copies]);

  function print() {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 300);
  }

  return (
    <div className="print-page">
      <div className="no-print">
        <h2>Tisk QR štítků</h2>
        <p className="muted">Vyber krabice a vytiskni nálepky na A4 (samolepicí papír).</p>
      </div>

      <div className="print-toolbar no-print">
        <div className="card">
          <h3>1. Vyber krabice</h3>
          <input className="input" placeholder="Hledat krabice…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="pick-list">
            {all.map((b) => (
              <label key={b.id} className={`pick-item ${selected.includes(b.id) ? 'picked' : ''}`}>
                <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggle(b.id)} />
                <span className="strong">{b.name}</span>
                {b.position && <span className="chip">{b.position}</span>}
                {b.location_name && <span className="muted small">{b.location_name}</span>}
              </label>
            ))}
            {all.length === 0 && <p className="muted">Žádné krabice nenalezeny.</p>}
          </div>
        </div>

        <div className="card">
          <h3>2. Nebo přidej novou krabici</h3>
          <div className="row">
            <input className="input" placeholder="Název" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input className="input pos-input" placeholder="Pozice (A1)" value={newPos} onChange={(e) => setNewPos(e.target.value.toUpperCase())} />
            <button className="btn btn-primary" onClick={addNew}>Přidat</button>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
        </div>

        <div className="card">
          <h3>3. Nastavení</h3>
          <div className="row">
            <label className="label-inline">Kopie: <input className="input num-input" type="number" min="1" max="50" value={copies} onChange={(e) => setCopies(Number(e.target.value) || 1)} /></label>
            <label className="label-inline">Sloupce: <select className="input" value={cols} onChange={(e) => setCols(Number(e.target.value))}>{[2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            <label className="label-inline">Řádky: <select className="input" value={rows} onChange={(e) => setRows(Number(e.target.value))}>{[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          </div>
          <button className="btn btn-primary btn-lg" onClick={print} disabled={labels.length === 0}>
            <Printer size={18} /> Tisknout ({labels.length} štítků)
          </button>
        </div>
      </div>

      <div className={`print-sheet-wrap ${printing ? 'active' : ''}`}>
        <div className="print-sheet" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
          {labels.map((b, i) => (
            <QRLabel key={`${b.id}-${i}`} value={b.id} name={b.name} position={b.position} size={140} />
          ))}
        </div>
      </div>
    </div>
  );
}
