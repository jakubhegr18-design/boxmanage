import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { api, fmtDate } from '../api';
import { Check, Bell, RefreshCw } from '../components/Icons';

const SESSION_KEY = 'boxmanage_remote_session';

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}

function saveSession(s) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

// Krátké pípnutí přes Web Audio API (bez zvukového souboru).
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* ignore */ }
}

export default function Remote() {
  const [session, setSession] = useState(null);
  const [qr, setQr] = useState('');
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const seenIds = useRef(new Set());
  const notifPermissionRef = useRef(notifPermission);
  notifPermissionRef.current = notifPermission;

  async function ensureSession() {
    const stored = loadSession();
    if (stored?.token) {
      try {
        await api(`/api/remote/${stored.token}`);
        return stored;
      } catch { /* session neexistuje -> vytvoř novou */ }
    }
    const s = await api('/api/remote/sessions', { method: 'POST' });
    saveSession(s);
    return s;
  }

  useEffect(() => {
    let cancelled = false;
    ensureSession().then((s) => {
      if (!cancelled) setSession(s);
    }).catch((err) => setError(err.message));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!session?.token) return;
    QRCode.toDataURL(`bm://remote?url=${encodeURIComponent(window.location.origin)}&s=${session.token}`, {
      width: 280,
      margin: 2,
      color: { dark: '#1f2937', light: '#ffffff' },
    }).then(setQr).catch(() => {});
  }, [session?.token]);

  async function loadEvents(token) {
    try {
      const data = await api(`/api/remote/${token}/events`);
      data.events?.forEach((e) => seenIds.current.add(e.id));
      setEvents(data.events || []);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!session?.token) return;
    loadEvents(session.token);

    const es = new EventSource(`/api/remote/${session.token}/stream`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.closed) {
          es.close();
          setConnected(false);
          return;
        }
        if (seenIds.current.has(data.id)) return;
        seenIds.current.add(data.id);
        setEvents((prev) => [data, ...prev]);
        beep();
        if (notifPermissionRef.current === 'granted' && 'Notification' in window) {
          try {
            new Notification('BoxManage — naskenováno', {
              body: `${data.box_name || data.box_id}${data.box_position ? ` (${data.box_position})` : ''}`,
              tag: `bm-remote-${data.id}`,
            });
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    };
    return () => {
      es.close();
      setConnected(false);
    };
  }, [session?.token]);

  async function newSession() {
    try {
      const s = await api('/api/remote/sessions', { method: 'POST' });
      saveSession(s);
      seenIds.current = new Set();
      setEvents([]);
      setSession(s);
    } catch (err) { setError(err.message); }
  }

  async function resolve(e) {
    try {
      await api(`/api/remote/${session.token}/events/${e.id}/resolve`, { method: 'POST' });
      setEvents((prev) => prev.map((x) => (x.id === e.id ? { ...x, resolved: 1 } : x)));
    } catch (err) { setError(err.message); }
  }

  async function enableNotifications() {
    if (!('Notification' in window)) return;
    const p = await Notification.requestPermission();
    setNotifPermission(p);
  }

  if (!session) {
    return <div className="center-page">Připravuji dálkový skener…</div>;
  }

  const pending = events.filter((e) => !e.resolved);
  const today = events.filter((e) => {
    const d = new Date(String(e.created_at).replace(' ', 'T') + 'Z');
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const sorted = [...events].sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.id - a.id);

  return (
    <div>
      <h2>Dálkový skener</h2>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="remote-head">
          <h3 style={{ margin: 0 }}>1. Připoj telefon</h3>
          <button className="btn btn-sm" onClick={newSession} title="Vygenerovat nový párovací kód"><RefreshCw size={14} /> Nový kód</button>
        </div>
        <p className="muted">
          V mobilní aplikaci otevři <strong>Sken</strong> a buď naskenuj QR, nebo zadej kód níže.
          Skenované krabice se sem budou posílat okamžitě.
        </p>
        <div className="pairing-row">
          <div className="qr-display">
            {qr ? <img src={qr} alt="Párovací QR kód" /> : <p className="muted">Generuji QR…</p>}
          </div>
          <div className="pairing-code-wrap">
            <div className="muted small">Ruční kód (zadej v aplikaci → Sken):</div>
            <div className="pairing-code">{session.code}</div>
            <div className="muted small">Server: <code>{window.location.origin}</code></div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="remote-head">
          <h3 style={{ margin: 0 }}>
            2. Fronta skenování{' '}
            <span className="badge b-warn">{pending.length} k vyřízení</span>{' '}
            <span className="badge">{today} dnes</span>
          </h3>
          <div className="row" style={{ gap: 6 }}>
            <span className={`conn-dot ${connected ? 'on' : ''}`} title={connected ? 'živé připojení' : 'připojení přerušeno'} />
            {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
              <button className="btn btn-sm" onClick={enableNotifications}><Bell size={14} /> Upozornění</button>
            )}
          </div>
        </div>
        <p className="muted small">
          {connected ? 'Živě — skeny přicházejí okamžitě.' : 'Připojuji se…'} Kliknutím na krabici ji otevřeš.
          Vyřízené položky odškrtni.
        </p>
        {sorted.length === 0 ? (
          <p className="muted">Zatím žádné skeny. Namiř mobil na QR kód na krabici.</p>
        ) : (
          <ul className="activity">
            {sorted.map((m) => (
              <li key={m.id} className={m.resolved ? 'done' : 'new'}>
                {m.resolved ? <Check size={15} className="done-ico" /> : <span className="badge b-warn">nové</span>}
                <Link to={`/boxes/${encodeURIComponent(m.box_id)}`} className="strong">{m.box_name || m.box_id}</Link>
                {m.box_position && <span className="chip">{m.box_position}</span>}
                <span className="muted time">{fmtDate(m.created_at)}</span>
                {!m.resolved && (
                  <button className="btn btn-sm" onClick={() => resolve(m)} title="Označit jako vyřízené"><Check size={14} /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Návod</h3>
        <ol className="steps">
          <li>Na PC otevři tento skener a nech ho na monitoru (kód i QR zůstávají).</li>
          <li>Mobilem v aplikaci <Link to="/scan">Sken</Link> naskenuj párovací QR, nebo zadej ruční kód <strong>{session.code}</strong>.</li>
          <li>Teď skenuj QR kódy na krabicích — tady se objeví okamžitě s pípnutím.</li>
          <li>Když krabici vyřídíš (najdeš ji, přebalíš), odškrtni ji tlačítkem ✓.</li>
        </ol>
      </div>
    </div>
  );
}
