const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
const NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function currentNum(text, label) {
  const m = text.match(new RegExp(label + '\\s+(\\d+)', 'i'));
  return m ? Math.max(1, Math.min(30, parseInt(m[1], 10))) : 1;
}

function applyToken(text, label, n) {
  const re = new RegExp(label + '\\s+\\d+', 'i');
  const token = label + ' ' + n;
  if (re.test(text)) return text.replace(re, token);
  return text + ' · ' + token;
}

export default function PositionPicker({ value, onChange, disabled }) {
  const v = String(value || '').toUpperCase();

  function append(ch) {
    const next = v + ch;
    onChange(next.length <= 8 ? next : v);
  }

  function backspace() {
    onChange(v.slice(0, -1));
  }

  function step(label, delta) {
    const m = v.match(new RegExp(label + '\\s+(\\d+)', 'i'));
    const cur = m ? parseInt(m[1], 10) : 0;
    const n = Math.max(1, Math.min(30, cur + delta));
    onChange(applyToken(v, label, n));
  }

  return (
    <div className={`position-picker ${disabled ? 'disabled' : ''}`}>
      <input
        className="position-input"
        value={v}
        placeholder="např. A1"
        maxLength={8}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        disabled={disabled}
        inputMode="text"
      />
      <div className="pos-letters">
        {LETTERS.map((l) => (
          <button key={l} type="button" className={`pos-key ${v.startsWith(l) ? 'pressed' : ''}`} onClick={() => append(l)} disabled={disabled}>
            {l}
          </button>
        ))}
      </div>
      <div className="pos-numbers">
        {NUMBERS.map((n) => (
          <button key={n} type="button" className={`pos-key ${v.endsWith(n) ? 'pressed' : ''}`} onClick={() => append(n)} disabled={disabled}>
            {n}
          </button>
        ))}
        <button type="button" className="pos-key" onClick={backspace} disabled={disabled}>⌫</button>
        <button type="button" className="pos-key" onClick={() => onChange('')} disabled={disabled}>✕</button>
      </div>

      <div className="pos-shelf">
        <span className="pos-shelf-label">Polička</span>
        <button type="button" className="pos-stepper-btn" onClick={() => step('POLIČKA', -1)} disabled={disabled}>-</button>
        <span className="pos-stepper-value">{currentNum(v, 'POLIČKA')}</span>
        <button type="button" className="pos-stepper-btn" onClick={() => step('POLIČKA', 1)} disabled={disabled}>+</button>
      </div>

      <div className="pos-shelf">
        <span className="pos-shelf-label">Šuplík</span>
        <button type="button" className="pos-stepper-btn" onClick={() => step('ŠUPLÍK', -1)} disabled={disabled}>-</button>
        <span className="pos-stepper-value">{currentNum(v, 'ŠUPLÍK')}</span>
        <button type="button" className="pos-stepper-btn" onClick={() => step('ŠUPLÍK', 1)} disabled={disabled}>+</button>
      </div>
    </div>
  );
}
