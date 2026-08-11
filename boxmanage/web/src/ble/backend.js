// BLE backendy pro tiskárnu Cat Printer: nativní (Capacitor) a Web Bluetooth.
// Nativní cesta (mobilní aplikace APK) přes @capacitor-community/bluetooth-le,
// webová cesta (Chrome/Edge na PC) přes Web Bluetooth API.
import { BluetoothLe } from '@capacitor-community/bluetooth-le';
import { bytesToHex, bytesToBase64, base64ToBytes, DATA_FLOW_PAUSE, DATA_FLOW_RESUME, detectModel, looksLikePrinter } from './protocol';

export function isNative() {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
}

export function isWebBluetoothSupported() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

const SERVICE_UUIDS = [
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Společný stav připojení
// ---------------------------------------------------------------------------
let conn = null;

export function getConnection() {
  return conn;
}

// ---------------------------------------------------------------------------
// Nativní backend (Capacitor)
// ---------------------------------------------------------------------------
let nativeNotifyListener = null;

function normalizeUuid(uuid) {
  return (uuid || '').toLowerCase();
}

function serviceMatches(uuid) {
  const u = normalizeUuid(uuid);
  return u.includes('ae00') || u.includes('ff00') || u.includes('ffe0') || u.includes('fff0');
}

async function nativeDiscover(deviceId) {
  const { services } = await BluetoothLe.getServices({ deviceId });
  let tx = null;
  let rx = null;

  for (const svc of services) {
    if (!serviceMatches(svc.uuid) && !serviceMatches(svc.serviceId)) continue;
    let chars;
    try {
      ({ characteristics: chars } = await BluetoothLe.getCharacteristics({ deviceId, serviceId: svc.serviceId }));
    } catch {
      continue;
    }
    for (const c of chars) {
      const props = Array.isArray(c.properties) ? c.properties : Object.keys(c.properties || {});
      const hasW = props.includes('write') || props.includes('writeWithoutResponse');
      const hasR = props.includes('read');
      const hasN = props.includes('notify') || props.includes('indicate');
      if (!tx && hasW) {
        if (!hasR || !props.includes('read')) {
          tx = { serviceId: svc.serviceId, characteristicId: c.characteristicId, wwr: props.includes('writeWithoutResponse') };
        }
      } else if (!rx && hasN) {
        rx = { serviceId: svc.serviceId, characteristicId: c.characteristicId };
      }
    }
    if (tx && rx) break;
  }

  // Druhý průchod bez podmínky "nečitelné" (některé čipy hlásí write i s read)
  if (!tx) {
    for (const svc of services) {
      if (!serviceMatches(svc.uuid) && !serviceMatches(svc.serviceId)) continue;
      let chars;
      try {
        ({ characteristics: chars } = await BluetoothLe.getCharacteristics({ deviceId, serviceId: svc.serviceId }));
      } catch {
        continue;
      }
      for (const c of chars) {
        const props = Array.isArray(c.properties) ? c.properties : Object.keys(c.properties || {});
        if (!tx && (props.includes('write') || props.includes('writeWithoutResponse'))) {
          tx = { serviceId: svc.serviceId, characteristicId: c.characteristicId, wwr: props.includes('writeWithoutResponse') };
        }
      }
    }
  }

  if (!tx) throw new Error('Na tiskárně se nenašla zapisovací charakteristika (0xAE01)');
  return { tx, rx };
}

function ensureNativeNotify() {
  if (nativeNotifyListener) return;
  nativeNotifyListener = BluetoothLe.addListener('onNotification', (data) => {
    if (!conn || !conn.paused) return;
    const hex = bytesToHex(base64ToBytes(data.value));
    if (hex === DATA_FLOW_PAUSE) conn.paused = true;
    else if (hex === DATA_FLOW_RESUME) conn.paused = false;
  });
}

async function nativeWrite(bytes) {
  const CHUNK = 180;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    while (conn?.paused) await sleep(80);
    const chunk = bytes.subarray(i, i + CHUNK);
    await BluetoothLe.write({
      deviceId: conn.deviceId,
      serviceId: conn.tx.serviceId,
      characteristicId: conn.tx.characteristicId,
      value: bytesToBase64(chunk),
      writeType: conn.tx.wwr ? 'withoutResponse' : 'withResponse',
    });
    await sleep(20);
  }
}

// ---------------------------------------------------------------------------
// Web backend (Web Bluetooth)
// ---------------------------------------------------------------------------
function charProps(c) {
  const p = c.properties;
  return {
    write: !!(p && (p.write || p.writeWithoutResponse)),
    wwr: !!(p && p.writeWithoutResponse),
    notify: !!(p && (p.notify || p.indicate)),
    read: !!(p && p.read),
  };
}

async function webDiscover(server) {
  let tx = null;
  let rx = null;
  for (const uuid of SERVICE_UUIDS) {
    let service;
    try {
      service = await server.getPrimaryService(uuid);
    } catch {
      continue;
    }
    const chars = await service.getCharacteristics();
    for (const c of chars) {
      const p = charProps(c);
      if (!tx && p.write && !p.read) tx = c;
      else if (!rx && p.notify) rx = c;
    }
    if (tx && rx) break;
  }
  if (!tx) {
    for (const uuid of SERVICE_UUIDS) {
      let service;
      try {
        service = await server.getPrimaryService(uuid);
      } catch {
        continue;
      }
      const chars = await service.getCharacteristics();
      for (const c of chars) {
        const p = charProps(c);
        if (!tx && p.write) tx = c;
      }
      if (tx) break;
    }
  }
  if (!tx) throw new Error('Na tiskárně se nenašla zapisovací charakteristika (0xAE01)');
  return { tx, rx };
}

async function webWrite(bytes) {
  const CHUNK = 180;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    while (conn?.paused) await sleep(80);
    const chunk = bytes.subarray(i, i + CHUNK);
    if (conn.tx.wwr) await conn.tx.writeValueWithoutResponse(chunk);
    else await conn.tx.writeValueWithResponse(chunk);
    await sleep(20);
  }
}

// ---------------------------------------------------------------------------
// Veřejné API
// ---------------------------------------------------------------------------

// Skenování/výběr zařízení. Vrací pole { deviceId, deviceName }.
export async function scanDevices({ onStatus, onResult } = {}) {
  if (isNative()) {
    await BluetoothLe.initialize();
    const devices = new Map();
    onStatus?.('Vyhledávám tiskárny…');
    await BluetoothLe.requestLEScan({ services: [], allowDuplicates: true });
    const scanListener = BluetoothLe.addListener('onScanResult', (r) => {
      const d = r.device || {};
      if (!d.deviceId || !d.name) return;
      if (devices.has(d.deviceId)) return;
      const info = { deviceId: d.deviceId, deviceName: d.name, model: detectModel(d.name) };
      devices.set(d.deviceId, info);
      onResult?.(info);
    });
    await sleep(8000);
    try { scanListener.remove(); } catch { /* ignore */ }
    try { await BluetoothLe.stopLEScan(); } catch { /* ignore */ }
    return [...devices.values()];
  }

  if (!isWebBluetoothSupported()) {
    throw new Error('Web Bluetooth není v tomto prohlížeči k dispozici (potřeba Chrome/Edge).');
  }
  onStatus?.('Vyber tiskárnu v dialogu prohlížeče…');
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICE_UUIDS,
  });
  const info = { deviceId: device.id, deviceName: device.name || 'Neznámá tiskárna', model: detectModel(device.name), raw: device };
  onResult?.(info);
  return [info];
}

// Připojí se k zařízení a najde tx/rx charakteristiky.
export async function connectDevice(device, { onStatus } = {}) {
  if (conn) await disconnect();
  onStatus?.(`Připojuji ${device.deviceName || 'zařízení'}…`);

  if (isNative()) {
    await BluetoothLe.connect({ deviceId: device.deviceId });
    const { tx, rx } = await nativeDiscover(device.deviceId);
    conn = { kind: 'native', deviceId: device.deviceId, deviceName: device.deviceName, tx, rx, paused: false };
    if (rx) {
      await BluetoothLe.startNotifications({ deviceId: device.deviceId, serviceId: rx.serviceId, characteristicId: rx.characteristicId });
      ensureNativeNotify();
    }
  } else {
    const server = await device.raw.gatt.connect();
    const { tx, rx } = await webDiscover(server);
    conn = { kind: 'web', deviceName: device.deviceName, server, tx, rx, paused: false };
    if (rx) {
      await rx.startNotifications();
      rx.addEventListener('characteristicvaluechanged', (ev) => {
        if (!conn || !conn.paused) return;
        const hex = bytesToHex(new Uint8Array(ev.target.value.buffer));
        if (hex === DATA_FLOW_PAUSE) conn.paused = true;
        else if (hex === DATA_FLOW_RESUME) conn.paused = false;
      });
    }
  }

  const model = detectModel(device.deviceName);
  return { deviceName: device.deviceName, model };
}

export function isConnected() {
  return !!conn;
}

export function getDeviceInfo() {
  return conn ? { deviceName: conn.deviceName } : null;
}

export async function sendCommands(commands, { onProgress, totalRows } = {}) {
  if (!conn) throw new Error('Tiskárna není připojená');
  const writer = conn.kind === 'native' ? nativeWrite : webWrite;
  for (let i = 0; i < commands.length; i++) {
    await writer(commands[i]);
    onProgress?.(i + 1, commands.length);
  }
}

export async function disconnect() {
  if (!conn) return;
  try {
    if (conn.kind === 'native') {
      await BluetoothLe.disconnect({ deviceId: conn.deviceId });
    } else if (conn.server) {
      try { await conn.rx?.stopNotifications?.(); } catch { /* ignore */ }
      try { conn.server.disconnect(); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  conn = null;
}

export function suggestedPaperWidth() {
  return 384;
}

export { looksLikePrinter };
