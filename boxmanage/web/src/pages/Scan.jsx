import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { api, getApiBase, setApiBase, getToken } from '../api';

const REMOTE_SESSION_KEY = 'boxmanage_remote_session';

function getRemoteSession() {
  try { return JSON.parse(localStorage.getItem(REMOTE_SESSION_KEY) || 'null'); } catch { return null; }
}

function saveRemoteSession(s) {
  localStorage.setItem(REMOTE_SESSION_KEY, JSON.stringify(s));
}

export default function Scan() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [manual, setManual] = useState('');
  const [notFound, setNotFound] = useState(null);
  const [remoteOn, setRemoteOn] = useState(() => localStorage.getItem('boxmanage_remote') === '1');
  const [remoteBase, setRemoteBase] = useState(getApiBase());
  const [remoteSession, setRemoteSession] = useState(getRemoteSession());
  const [pairCode, setPairCode] = useState('');
  const [pairMsg, setPairMsg] = useState('');
  const [pairError, setPairError] = useState('');

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
    if (raw.startsWith('bm://item')) {
      handleItem(raw);
      return;
    }
    const id = raw.startsWith('bm://') ? raw.slice(5) : raw;
    if (!scannerRef.current?.isScanning) return;
    stopScanner();
    openBox(id);
  }

  async function handleItem(raw) {
    const qs = new URLSearchParams(String(raw.split('?')[1] || ''));
    const b = qs.get('b');
    const i = qs.get('i');
    if (!b || !i) { alert('Neplatný QR kód položky.'); return; }
    if (!scannerRef.current?.isScanning) return;
    await stopScanner();
    try {
      await api(`/api/boxes/${encodeURIComponent(b)}`);
      if (localStorage.getItem('boxmanage_remote') === '1') {
        const sess = getRemoteSession();
        api(`/api/boxes/${encodeURIComponent(b)}/scan`, { method: 'POST', body: sess ? { session: sess.token } : {} }).catch(() => {});
      }
      navigate(`/boxes/${encodeURIComponent(b)}?item=${encodeURIComponent(i)}`);
    } catch {
      setNotFound(b);
    }
  }

  async function handlePairing(raw) {
    const qs = new URLSearchParams(String(raw.split('?')[1] || ''));
    const url = qs.get('url');
    const s = qs.get('s');
    if (!url) { alert('Neplatný párovací QR kód.'); return; }
    await stopScanner();
    setApiBase(url);
    localStorage.setItem('boxmanage_remote', '1');
    if (s) {
      saveRemoteSession({ token: s });
      setRemoteSession({ token: s });
    }
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

  async function joinScanner(e) {
    e.preventDefault();
    setPairMsg(''); setPairError('');
    const code = pairCode.trim();
    if (!code) return;
    try {
      const r = await api('/api/remote/join', { method: 'POST', body: { code } });
      saveRemoteSession({ token: r.token, code: r.code });
      setRemoteSession({ token: r.token, code: r.code });
      localStorage.setItem('boxmanage_remote', '1');
      setRemoteOn(true);
      setPairCode('');
      setPairMsg(`Připojeno ke skeneru (kód ${r.code}). Skenované krabice se na PC objeví živě.`);
    } catch (err) {
      setPairError(err.message);
    }
  }

  function disconnectScanner() {
    localStorage.removeItem(REMOTE_SESSION_KEY);
    setRemoteSession(null);
    setPairMsg('Odpojeno od dálkového skeneru.');
  }

  async function openBox(id) {
    try {
      await api(`/api/boxes/${id}`);
      if (localStorage.getItem('boxmanage_remote') === '1') {
        const sess = getRemoteSession();
        api(`/api/boxes/${id}/scan`, { method: 'POST', body: sess ? { session: sess.token } : {} }).catch(() => {});
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

      <div className="card">
        <h3>Dálkový režim</h3>
        <p className="muted">
          Zapni dálkový režim, když skenuješ na dálku — naskenované krabice se
          zobrazí na PC na stránce <strong>Dálkový skener</strong>.
        </p>
          <label className="label-inline" style={{ margin: '8px 0' }}>
            <input type="checkbox" checked={remoteOn} onChange={toggleRemote} />
            Dálkový režim
          </label>

          {remoteSession ? (
            <div className="pair-status">
              <span className="badge b-warn">připojeno ke skeneru{remoteSession.code ? ` (${remoteSession.code})` : ''}</span>
              <button className="btn btn-sm" onClick={disconnectScanner}>Odpojit</button>
            </div>
          ) : (
            <form onSubmit={joinScanner} className="row" style={{ marginTop: 8 }}>
              <input
                className="input"
                placeholder="Kód ze skeneru (6 znaků)"
                value={pairCode}
                onChange={(e) => setPairCode(e.target.value.toUpperCase())}
                maxLength={6}
              />
              <button className="btn btn-primary" type="submit">Připojit</button>
            </form>
          )}
          {pairMsg && <div className="alert alert-info">{pairMsg}</div>}
          {pairError && <div className="alert alert-error">{pairError}</div>}
          <p className="muted small">Server: <code>{remoteBase || 'není nastaven'}</code></p>
          <p className="muted small">
            QR kód z <strong>Dálkového skeneru</strong> nastaví adresu serveru i připojení
            ke skeneru automaticky. Kód „připojí" jen k serveru, ke kterému je telefon
            přihlášený.
          </p>
        </div>

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
