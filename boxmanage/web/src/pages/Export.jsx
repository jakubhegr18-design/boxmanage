import { useState } from 'react';
import { downloadFile } from '../api';
import { Download } from '../components/Icons';

export default function Export() {
  const [msg, setMsg] = useState('');

  async function doExport(kind) {
    setMsg('');
    try {
      const name = kind === 'csv' ? 'boxmanage-export.csv' : 'boxmanage-export.xlsx';
      await downloadFile(`/api/export/${kind}`, name);
      setMsg(`Export ${kind.toUpperCase()} stažen.`);
    } catch (err) {
      setMsg(`Chyba: ${err.message}`);
    }
  }

  return (
    <div>
      <h2>Export</h2>
      <div className="card">
        <p className="muted">
          Exportuj celou inventuru. Soubor obsahuje krabice, položky s množstvím, pozice, lokace a historii.
        </p>
        <div className="row">
          <button className="btn btn-primary" onClick={() => doExport('csv')}><Download size={16} /> Export CSV (Excel)</button>
          <button className="btn btn-primary" onClick={() => doExport('xlsx')}><Download size={16} /> Export XLSX</button>
        </div>
        {msg && <div className="alert alert-info">{msg}</div>}
      </div>
    </div>
  );
}
