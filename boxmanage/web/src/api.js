import { navigate } from './navigate';
import { isNative } from './ble/backend';

const TOKEN_KEY = 'boxmanage_token';
const API_BASE_KEY = 'boxmanage_api_url';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// Normalizace adresy serveru pro nativní mobilní aplikaci:
// - vynutí https (jediný port add-onu je 8090 s HTTPS),
// - staré HTTP adresy s portem 8092 (předchozí verze) se přepíšou na 8090,
// - adresa bez protokolu se doplní na https://….
export function normalizeServerUrl(u) {
  let s = String(u || '').trim().replace(/\/+$/, '');
  if (!s) return '';
  s = s.replace(/^http:\/\//i, 'https://').replace(/:8092$/i, ':8090');
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) s = `https://${s}`;
  return s;
}

function normalizeApiBase(u) {
  return normalizeServerUrl(u);
}

export function getApiBase() {
  try {
    const stored = localStorage.getItem(API_BASE_KEY);
    if (!stored) return '';
    // V prohlížeči (PWA) se API vždy volá na stejný origin. Uloženou adresu
    // ignorujeme — jinak by se z HTTPS stránky volalo na HTTP a prohlížeč by
    // blokoval (mixed content) a přihlášení by spadlo na „Failed to fetch“.
    return isNative() ? normalizeApiBase(stored) : '';
  } catch {
    return '';
  }
}

export function setApiBase(url) {
  if (url && typeof url === 'string' && isNative()) {
    localStorage.setItem(API_BASE_KEY, normalizeApiBase(url));
  } else {
    localStorage.removeItem(API_BASE_KEY);
  }
}

// Rozdělení uložené adresy na hostitele (IP/doména) a port — pro formulář
// s odděleným polem IP adresy a portu.
export function getApiHostPort() {
  const raw = normalizeApiBase(localStorage.getItem(API_BASE_KEY) || '');
  if (!raw) return { host: '', port: '8090' };
  try {
    const u = new URL(raw);
    return { host: u.hostname, port: u.port || '8090' };
  } catch {
    return { host: '', port: '8090' };
  }
}

export function setApiHostPort(host, port) {
  const h = String(host || '').trim();
  const p = String(port || '8090').trim() || '8090';
  if (!h) {
    setApiBase('');
    return;
  }
  setApiBase(`https://${h}:${p}`);
}

// Jednoduchý event bus: ostatní části aplikace (App.jsx) na tuto událost
// reagují zobrazením dialogu pro nastavení adresy serveru — buď při prvním
// spuštění (žádná adresa uložena), nebo když se nelze připojit.
export function requestServerSetup(reason, message) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('boxmanage:server-needed', { detail: { reason, message } }));
}

// V nativní mobilní aplikaci se API volá na absolutní adresu BoxManage serveru,
// v prohlížeči zůstává relativní (stejné origin).
export function apiUrl(path) {
  const base = getApiBase();
  return base ? base + path : path;
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData) && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  let res;
  try {
    res = await fetch(apiUrl(path), { ...options, headers });
  } catch (err) {
    // Selhání na úrovni sítě (špatná/neplatná adresa serveru, server běží jinde…).
    // V nativní aplikaci rovnou nabídneme dialog pro změnu IP adresy a portu.
    if (isNative()) {
      requestServerSetup('error', 'Nelze se připojit k serveru BoxManage. Zkontroluj adresu a port.');
    }
    throw err;
  }
  if (res.status === 401) {
    setToken(null);
    if (window.location.pathname !== '/login') navigate('/login');
    throw new Error('Přihlášení vypršelo');
  }
  const type = res.headers.get('content-type') || '';
  if (!res.ok) {
    let msg = `Chyba ${res.status}`;
    try {
      if (type.includes('application/json')) {
        const data = await res.json();
        msg = data.error || msg;
      } else {
        msg = await res.text();
      }
    } catch { /* ignore */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (type.includes('application/json')) return res.json();
  if (type.includes('text/')) return res.text();
  return res;
}

export async function downloadFile(path, filename) {
  const res = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`Stažení selhalo (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function fmtQty(n) {
  const num = Number(n);
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '');
}

export function fmtDate(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T') + (String(s).includes('Z') ? '' : 'Z'));
  return d.toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' });
}
