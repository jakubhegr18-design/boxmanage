import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { printBoxLabel, scanDevices, disconnect, connectDevice } from '../ble/printer';
import { isNative, isWebBluetoothSupported } from '../ble/backend';
import { ChevronLeft, Bluetooth, RefreshCw, Printer } from '../components/Icons';

export default function PrintBle() {
  const { id } = useParams();
  const [box, setBox] = useState(null);
  const [devices, setDevices] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [connected, setConnected] = useState(null);
  const [selected, setSelected] = useState(null);
  const [width, setWidth] = useState(384);
  const [energy, setEnergy] = useState(15000);
  const [flipV, setFlipV] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/api/boxes/${id}`).then(setBox).catch((e) => setError(e.message));
  }, [id]);

  const bleOk = isNative() || isWebBluetoothSupported();

  async function find() {
    setError('');
    setStatus('');
    setDevices([]);
    setScanning(true);
    try {
      const list = await scanDevices({
        onStatus: setStatus,
        onResult: (d) => setDevices((prev) => [...prev, d]),
      });
      if (list.length === 1 && isWebBluetoothSupported() && !isNative()) {
        await connect(list[0]);
      } else if (list.length === 0 && !isNative()) {
        setError('Žádná tiskárna nevybrána.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setScanning(false);
      setStatus('');
    }
  }

  async function connect(device) {
    setError('');
    setStatus(`Připojuji ${device.deviceName}…`);
    try {
      const info = await connectDevice(device, { onStatus: setStatus });
      setSelected(device);
      setConnected(info);
      setStatus('Připojeno.');
    } catch (e) {
      setError(e.message);
    }
  }

  async function doPrint() {
    setError('');
    setPrinting(true);
    setProgress(0);
    try {
      await printBoxLabel(id, {
        device: selected,
        width,
        energy,
        flipV,
        onStatus: setStatus,
        onProgress: setProgress,
      });
      setSelected(null);
      setConnected(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setPrinting(false);
      setStatus('');
    }
  }

  async function unconnect() {
    await disconnect().catch(() => {});
    setSelected(null);
    setConnected(null);
    setStatus('');
  }

  return (
    <div>
      <Link to="/boxes" className="back-link"><ChevronLeft size={16} /> Krabice</Link>
      <div className="detail-head">
        <div>
          <h2>Tisk štítku přes Bluetooth</h2>
          {box && (
            <div className="box-meta">
              <span className="strong">{box.name}</span>
              <span className="muted small">ID: <code>{box.id}</code></span>
            </div>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {status && <div className="alert alert-info">{status}</div>}

      {!bleOk && (
        <div className="card">
          <p className="muted">Bluetooth není v tomto prohlížeči podporované. Použij nativní mobilní aplikaci (APK) nebo Chrome/Edge.</p>
        </div>
      )}

      {bleOk && (
        <div className="card">
          <h3>Tiskárna</h3>
          {!connected ? (
            <>
              <button className="btn btn-primary" onClick={find} disabled={scanning}>
                {scanning ? <RefreshCw size={18} /> : <Bluetooth size={18} />}
                {scanning ? ' Vyhledávám…' : ' Vyhledat tiskárnu'}
              </button>
              {devices.length > 0 && (
                <div className="pick-list">
                  {devices.map((d) => (
                    <div key={d.deviceId} className="pick-item">
                      <span className="strong">{d.deviceName}</span>
                      {d.model && <span className="chip">{d.model}</span>}
                      <button className="btn btn-sm" onClick={() => connect(d)}>Připojit</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="row">
              <span className="strong"><Bluetooth size={16} /> {connected.deviceName}</span>
              {connected.model && <span className="chip">{connected.model}</span>}
              <button className="btn btn-sm" onClick={unconnect}>Odpojit</button>
            </div>
          )}
        </div>
      )}

      {connected && (
        <>
          <div className="card">
            <h3>Nastavení tisku</h3>
            <div className="row">
              <label className="label-inline">Šířka papíru:
                <select className="input" value={width} onChange={(e) => setWidth(Number(e.target.value))}>
                  <option value={384}>58 mm (384 px)</option>
                  <option value={576}>80 mm (576 px)</option>
                </select>
              </label>
              <label className="label-inline">Energie (tmavost):
                <select className="input" value={energy} onChange={(e) => setEnergy(Number(e.target.value))}>
                  <option value={12000}>Slabší</option>
                  <option value={15000}>Normální</option>
                  <option value={18000}>Silnější</option>
                </select>
              </label>
              <label className="label-inline">
                <input type="checkbox" checked={flipV} onChange={(e) => setFlipV(e.target.checked)} /> Převrátit svisle
              </label>
            </div>
          </div>

          <div className="card">
            <h3>Tisk</h3>
            {printing && progress > 0 && progress < 100 && (
              <progress className="progress" value={progress} max="100">{progress} %</progress>
            )}
            <button className="btn btn-primary btn-lg" onClick={doPrint} disabled={printing}>
              <Printer size={18} /> {printing ? 'Tisknu…' : 'Vytisknout štítek'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
