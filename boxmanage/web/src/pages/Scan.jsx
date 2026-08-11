import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { api, getApiBase, setApiBase, getToken } from '../api';
import { isNative } from '../ble/backend';

export default function Scan() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [manual, setManual] = useState('');
  const [notFound, setNotFound] = useState(null);
  const [remoteOn, setRemoteOn] = useState(() => localStorage.getItem('boxmanage_remote') === '1');
  const [remoteBase, setRemoteBase] = useState(getApiBase());

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

  async function stopScanner() {
    if (!scannerRef.current?.isScanning) return;
    try {
      await scannerRef.current.stop();
      scannerRef.current.clear();
    } catch { /* ignore */ }
    setStarted(false);
  }

  function handleCode(text) {
    const raw = String(text).trim();
    if (raw.startsWith('bm://remote')) {
      handlePairing(raw);
      return;
    }
    const id = raw.startsWith('bm://') ? raw.slice(5) : raw;
    if (!scannerRef.current?.isScanning) return;
    stopScanner();
    openBox(id);
  }

  async function handlePairing(raw) {
    const url = new URLSearchParams(String(raw.split('?')[1] || '')).get('url');
    if (!url) { alert('Neplatný párovací QR kód.'); return; }
    await stopScanner();
    if (!isNative()) {
      alert('Tento QR je určený pro mobilní aplikaci BoxManage.');
      return;
    }
    setApiBase(url);
    localStorage.setItem('boxmanage_remote', '1');
    setRemoteOn(true);
    setRemoteBase(getApiBase());
    alert(`Server nastaven:\n${getApiBase() || url}\n\nPřihlas se a skenuj krabice.`);
    navigate(getToken() ? '/scan' : '/login');
  }

  function toggleRemote(e) {
    const on = e.target.checked;
    setRemoteOn(on);
    if (on) localStorage.setItem('boxmanage_remote', '1');
    else localStorage.removeItem('boxmanage_remote');
  }

  async function openBox(id) {
    try {
      await api(`/api/boxes/${id}`);
      if (localStorage.getItem('boxmanage_remote') === '1') {
        api(`/api/boxes/${id}/scan`, { method: 'POST' }).catch(() => {});
      }
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

      {isNative() && (
        <div className="card">
          <h3>Dálkový režim</h3>
          <p className="muted">
            Zapni dálkový režim, když skenuješ na dálku — naskenované krabice se
            zobrazí na PC na stránce <strong>Dálkový skener</strong>.
            Párovací QR kód z PC nastaví adresu serveru automaticky.
          </p>
          <label className="label-inline" style={{ margin: '8px 0' }}>
            <input type="checkbox" checked={remoteOn} onChange={toggleRemote} />
            Dálkový režim
          </label>
          <p className="muted small">Server: <code>{remoteBase || 'není nastaven'}</code></p>
        </div>
      )}

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
