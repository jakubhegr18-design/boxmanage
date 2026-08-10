import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '../api';

export default function Scan() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [manual, setManual] = useState('');
  const [notFound, setNotFound] = useState(null);

  useEffect(() => {
    const el = document.getElementById('qr-reader');
    if (!el) return;
    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: (vw, vh) => ({ width: Math.min(vw, vh) * 0.7, height: Math.min(vw, vh) * 0.7 }) },
      (text) => handleCode(text),
      () => {}
    ).then(() => setStarted(true)).catch((err) => setError(`Kamera není dostupná: ${err}`));

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().then(() => scannerRef.current.clear()).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCode(text) {
    const raw = String(text).trim();
    const id = raw.startsWith('bm://') ? raw.slice(5) : raw;
    if (!scannerRef.current?.isScanning) return;
    try {
      await scannerRef.current.stop();
      scannerRef.current.clear();
    } catch { /* ignore */ }
    setStarted(false);
    openBox(id);
  }

  async function openBox(id) {
    try {
      await api(`/api/boxes/${id}`);
      navigate(`/boxes/${id}`);
    } catch {
      setNotFound(id);
    }
  }

  function submitManual(e) {
    e.preventDefault();
    if (manual.trim()) openBox(manual.trim());
  }

  return (
    <div>
      <h2>Scan QR kódu</h2>

      {!error && (
        <div className="card">
          <div id="qr-reader" className="qr-reader" />
          {!started && !notFound && <p className="muted center">Spouštím kameru…</p>}
          <p className="muted small center">Namiř kameru na QR kód na krabici</p>
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3>Nebo zadej ID ručně</h3>
        <form onSubmit={submitManual} className="row">
          <input className="input" placeholder="bm-…" value={manual} onChange={(e) => setManual(e.target.value)} />
          <button className="btn btn-primary" type="submit">Otevřít</button>
        </form>
      </div>

      {notFound && (
        <div className="alert alert-warning">
          Krabice <code>{notFound}</code> neexistuje.{' '}
          <Link to={`/boxes/new?from=${encodeURIComponent(notFound)}`}>Vytvořit novou krabici →</Link>
        </div>
      )}
    </div>
  );
}
