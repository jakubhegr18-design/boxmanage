import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(__dirname, '..', 'public', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

const BG = [15, 23, 42]; // #0f172a
const FG = [255, 255, 255];

function roundedRect(png, size, x0, y0, x1, y1, r, color) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let dx = 0, dy = 0;
      if (x < x0 + r && y < y0 + r) { dx = x0 + r - x; dy = y0 + r - y; }
      else if (x > x1 - r && y < y0 + r) { dx = x - (x1 - r); dy = y0 + r - y; }
      else if (x < x0 + r && y > y1 - r) { dx = x0 + r - x; dy = y - (y1 - r); }
      else if (x > x1 - r && y > y1 - r) { dx = x - (x1 - r); dy = y - (y1 - r); }
      if (dx * dx + dy * dy <= r * r || (x >= x0 + r && x <= x1 - r) || (y >= y0 + r && y <= y1 - r)) {
        const idx = (y * size + x) * 4;
        png.data[idx] = color[0]; png.data[idx + 1] = color[1]; png.data[idx + 2] = color[2]; png.data[idx + 3] = 255;
      }
    }
  }
}

function fillRect(png, size, x0, y0, x1, y1, color) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const idx = (y * size + x) * 4;
      png.data[idx] = color[0]; png.data[idx + 1] = color[1]; png.data[idx + 2] = color[2]; png.data[idx + 3] = 255;
    }
  }
}

function drawIcon(size, maskable = false) {
  const png = new PNG({ width: size, height: size });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0; png.data[i + 1] = 0; png.data[i + 2] = 0; png.data[i + 3] = 0;
  }

  const pad = maskable ? Math.floor(size * 0.2) : 0;
  const inset = Math.floor(size * 0.06) + pad;
  const radius = Math.floor(size * 0.14);

  roundedRect(png, size, pad, pad, size - 1 - pad, size - 1 - pad, radius, BG);
  roundedRect(png, size, inset, inset, size - 1 - inset, size - 1 - inset, radius - Math.floor(size * 0.02), FG);

  const g = Math.floor(size * 0.2); // inner grid size
  const cell = Math.max(1, Math.floor(size * 0.045));
  const ox = Math.floor((size - g) / 2);
  const oy = Math.floor((size - g) / 2);

  // finder pattern top-left
  const f = Math.floor(size * 0.16);
  fillRect(png, size, ox, oy, ox + f - 1, oy + f - 1, BG);
  fillRect(png, size, ox + cell, oy + cell, ox + f - 1 - cell, oy + f - 1 - cell, FG);
  fillRect(png, size, ox + 2 * cell, oy + 2 * cell, ox + f - 1 - 2 * cell, oy + f - 1 - 2 * cell, BG);

  // finder pattern top-right
  fillRect(png, size, ox + g - f, oy, ox + g - 1, oy + f - 1, BG);
  fillRect(png, size, ox + g - f + cell, oy + cell, ox + g - 1 - cell, oy + f - 1 - cell, FG);
  fillRect(png, size, ox + g - f + 2 * cell, oy + 2 * cell, ox + g - 1 - 2 * cell, oy + f - 1 - 2 * cell, BG);

  // finder pattern bottom-left
  fillRect(png, size, ox, oy + g - f, ox + f - 1, oy + g - 1, BG);
  fillRect(png, size, ox + cell, oy + g - f + cell, ox + f - 1 - cell, oy + g - 1 - cell, FG);
  fillRect(png, size, ox + 2 * cell, oy + g - f + 2 * cell, ox + f - 1 - 2 * cell, oy + g - 1 - 2 * cell, BG);

  // data modules (random-ish fixed pattern)
  const cols = Math.floor((g - 2 * f) / (cell + 1));
  const seed = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0];
  let si = 0;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < cols; j++) {
      if (seed[(si++) % seed.length]) {
        fillRect(png, size, ox + f + i * (cell + 1), oy + f + j * (cell + 1), ox + f + i * (cell + 1) + cell, oy + f + j * (cell + 1) + cell, BG);
      }
    }
  }

  return PNG.sync.write(png);
}

for (const [file, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
]) {
  fs.writeFileSync(path.join(iconsDir, file), drawIcon(size, maskable));
  console.log(`[icons] ${file} generated`);
}
