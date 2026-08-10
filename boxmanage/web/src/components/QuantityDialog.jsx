import { useState } from 'react';
import Modal from './Modal';

export default function QuantityDialog({ open, title, onClose, onConfirm, defaultQty = 1 }) {
  const [qty, setQty] = useState(defaultQty);

  function submit(e) {
    e.preventDefault();
    const n = Number(qty);
    if (!isFinite(n) || n <= 0) return;
    onConfirm(n);
    setQty(1);
  }

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form onSubmit={submit} className="modal-form">
        <input
          className="input big-input"
          type="number"
          inputMode="decimal"
          step="any"
          min="0.01"
          value={qty}
          autoFocus
          onChange={(e) => setQty(e.target.value)}
        />
        <div className="qty-quick">
          {[1, 5, 10, 25, 50, 100].map((n) => (
            <button key={n} type="button" className="btn btn-sm" onClick={() => setQty(n)}>{n}</button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Zrušit</button>
          <button type="submit" className="btn btn-primary">Potvrdit</button>
        </div>
      </form>
    </Modal>
  );
}
