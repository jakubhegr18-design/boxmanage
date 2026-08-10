import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QRLabel({ value, name, position, size = 160, className = '' }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size,
      color: { dark: '#000000', light: '#ffffff' },
    }).then((url) => { if (alive) setDataUrl(url); });
    return () => { alive = false; };
  }, [value, size]);

  return (
    <div className={`qr-label ${className}`}>
      {dataUrl ? <img className="qr-img" src={dataUrl} alt="QR kód" style={{ width: size, height: size }} /> : <div className="qr-img" style={{ width: size, height: size }} />}
      <div className="qr-name">{name}</div>
      {position ? <div className="qr-pos">{position}</div> : null}
    </div>
  );
}
