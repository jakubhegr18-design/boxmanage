import { useEffect, useState } from 'react';
import { getApiHostPort, setApiHostPort, normalizeServerUrl } from '../api';
import { isNative } from '../ble/backend';

// Dialog pro zadání IP adresy a portu BoxManage serveru.
// Zobrazí se automaticky:
//  - při prvním spuštění nativní aplikace (žádná adresa ještě uložena) — nejde zavřít
//  - kdykoli selže síťový požadavek (nelze se připojit) — jde odložit na později
function cleanHost(host) {
  return String(host || '').trim().replace(/:\d+$/, '');
}

export default function ServerDialog() {
  const [open, setOpen] = useState(false);
  const [dismissible, setDismissible] = useState(true);
  const [info, setInfo] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8090');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!isNative()) return;
    const { host: h, port: p } = getApiHostPort();
    setHost(cleanHost(h));
    setPort(p || '8090');
    // První spuštění — adresa serveru ještě není nastavená.
    if (!h) {
      setOpen(true);
      setDismissible(false);
      setInfo('Vítej v BoxManage! Než se přihlásíš, zadej IP adresu a port add-onu.');
    }

    function onNeeded(e) {
      const { host: h2, port: p2 } = getApiHostPort();
      setHost(cleanHost(h2));
      setPort(p2 || '8090');
      setOpen(true);
      setDismissible(true);
      setInfo(e?.detail?.message || 'Nelze se připojit k serveru.');
      setError('');
      setMsg('');
    }
    window.addEventListener('boxmanage:server-needed', onNeeded);
    return () => window.removeEventListener('boxmanage:server-needed', onNeeded);
  }, []);

  if (!open) return null;

  async function test() {
    setError(''); setMsg('');
    const h = cleanHost(host);
    if (!h) {
      setError('Zadej IP adresu nebo doménu serveru.');
      return;
    }
    const base = normalizeServerUrl(`${h}:${port || '8090'}`);
    setTesting(true);
    try {
      const res = await fetch(base + '/api/auth/me');
      if (res.status === 401 || res.ok) setMsg('Spojení OK.');
      else setError(`Server odpověděl: ${res.status}`);
    } catch (err) {
      setError(`Nelze se připojit: ${err.message}`);
    } finally {
      setTesting(false);
    }
  }

  function save() {
    setError('');
    const h = cleanHost(host);
    if (!h) {
      setError('Zadej IP adresu nebo doménu serveru.');
      return;
    }
    setApiHostPort(h, port || '8090');
    setOpen(false);
    setMsg('');
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 'min(420px, 92vw)' }}>
        <div className="modal-head"><h3>Adresa serveru</h3></div>
        <div className="modal-body modal-form">
          {info && <p className="muted small">{info}</p>}
          <label className="label">IP adresa / doména</label>
          <input
            className="input"
            placeholder="192.0.2.10"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            inputMode="url"
            autoCapitalize="none"
            autoFocus
          />
          <label className="label">Port</label>
          <input
            className="input"
            placeholder="8090"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            inputMode="numeric"
          />
          {error && <div className="alert alert-error">{error}</div>}
          {msg && <div className="alert alert-info">{msg}</div>}
          <div className="modal-actions">
            <button className="btn" type="button" onClick={test} disabled={testing}>
              {testing ? 'Testuji…' : 'Otestovat'}
            </button>
            <button className="btn btn-primary" type="button" onClick={save}>Uložit</button>
            {dismissible && (
              <button className="btn" type="button" onClick={() => { setOpen(false); setMsg(''); }}>Později</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}