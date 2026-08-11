// Vysokoúrovňový tisk QR štítku na termotiskárnu Cat Printer.
import { apiUrl, getToken } from '../api';
import { buildPrintCommands, detectModel } from './protocol';
import { scanDevices, connectDevice, sendCommands, disconnect } from './backend';

export async function fetchLabelPng(id, width) {
  const res = await fetch(apiUrl(`/api/boxes/${id}/label.png?width=${width}`), {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`Stažení štítku selhalo (${res.status})`);
  return res.arrayBuffer();
}

export async function decodePngToBitmap(arrayBuffer, paperWidth) {
  let bmp;
  if (typeof createImageBitmap === 'function') {
    bmp = await createImageBitmap(new Blob([arrayBuffer], { type: 'image/png' }));
  } else {
    bmp = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(new Blob([arrayBuffer], { type: 'image/png' }));
    });
  }

  const scale = paperWidth / bmp.width;
  const height = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = paperWidth;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, paperWidth, height);
  const img = ctx.getImageData(0, 0, paperWidth, height);

  const bytesPerLine = paperWidth / 8;
  const data = new Uint8Array(bytesPerLine * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < paperWidth; x++) {
      const p = (y * paperWidth + x) * 4;
      const lum = img.data[p] * 0.299 + img.data[p + 1] * 0.587 + img.data[p + 2] * 0.114;
      if (lum < 128) data[y * bytesPerLine + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  if (bmp.close) bmp.close();
  return { data, height, bytesPerLine };
}

// Připojí se, vytiskne štítek jedné krabice a odpojí.
export async function printBoxLabel(id, {
  device,
  width = 384,
  energy = 15000,
  flipV = false,
  flipH = false,
  onStatus,
  onProgress,
} = {}) {
  onStatus?.('Připojuji tiskárnu…');
  const { model } = await connectDevice(device, { onStatus });

  try {
    onStatus?.('Stahuji štítek…');
    const png = await fetchLabelPng(id, width);
    onStatus?.('Připravuji bitmapu…');
    const { data, height, bytesPerLine } = await decodePngToBitmap(png, width);

    let rows = data;
    if (flipV || flipH) {
      rows = flipBitmap(rows, width, bytesPerLine, flipH, flipV);
    }

    const detected = detectModel(device.deviceName) || model || null;
    const newKind = detected === 'GB03';
    const problemFeeding = detected ? /^MX(05|06|08|09|10)$/.test(detected) : false;

    const commands = buildPrintCommands({
      rows,
      bytesPerLine,
      energy,
      newKind,
      problemFeeding,
    });

    onStatus?.(`Tisknu štítek (${height} řádků)…`);
    await sendCommands(commands, {
      onProgress: (done, total) => onProgress?.(Math.round((done / total) * 100)),
    });
    onStatus?.('Hotovo.');
  } finally {
    await disconnect().catch(() => {});
  }
}

function flipBitmap(data, width, bytesPerLine, horizontally, vertically) {
  const height = data.length / bytesPerLine;
  const out = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) {
    const sy = vertically ? height - 1 - y : y;
    for (let x = 0; x < width; x++) {
      const byte = sy * bytesPerLine + (x >> 3);
      const bit = (data[byte] >> (7 - (x & 7))) & 1;
      const dx = horizontally ? width - 1 - x : x;
      const dy = y;
      if (bit) out[dy * bytesPerLine + (dx >> 3)] |= 0x80 >> (dx & 7);
    }
  }
  return out;
}

export { scanDevices, disconnect, connectDevice };
