// Erzeugt App-Icons (PNG) ohne externe Abhängigkeiten: Koffer auf Teal-Hintergrund.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePNG(size, pixels) {
  // pixels: RGBA Uint8Array (size*size*4)
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // Filter: none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inRoundRect(x, y, rx, ry, rw, rh, rad) {
  if (x < rx || x >= rx + rw || y < ry || y >= ry + rh) return false;
  const cx = Math.max(rx + rad, Math.min(x, rx + rw - rad));
  const cy = Math.max(ry + rad, Math.min(y, ry + rh - rad));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= rad * rad || (x >= rx + rad && x < rx + rw - rad) || (y >= ry + rad && y < ry + rh - rad);
}

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const S = size / 512; // Basis-Design auf 512 skaliert
  const bg = [14, 124, 134], bgDark = [10, 96, 104], white = [255, 255, 255], strap = [230, 168, 60];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let c = null;
      // Hintergrund: abgerundetes Quadrat mit leichtem Verlauf
      if (inRoundRect(x, y, 0, 0, size, size, 110 * S)) {
        const f = y / size;
        c = [bg[0] + (bgDark[0] - bg[0]) * f, bg[1] + (bgDark[1] - bg[1]) * f, bg[2] + (bgDark[2] - bg[2]) * f];
      } else {
        // transparent ausserhalb
        continue;
      }
      // Koffergriff
      if (inRoundRect(x, y, 196 * S, 96 * S, 120 * S, 70 * S, 24 * S) &&
          !inRoundRect(x, y, 222 * S, 122 * S, 68 * S, 44 * S, 12 * S)) c = white;
      // Kofferkörper
      if (inRoundRect(x, y, 116 * S, 150 * S, 280 * S, 250 * S, 36 * S)) c = white;
      // Riemen
      if (inRoundRect(x, y, 116 * S, 150 * S, 280 * S, 250 * S, 36 * S)) {
        if ((x >= 176 * S && x < 204 * S) || (x >= 308 * S && x < 336 * S)) c = strap;
      }
      const i = (y * size + x) * 4;
      px[i] = Math.round(c[0]); px[i + 1] = Math.round(c[1]); px[i + 2] = Math.round(c[2]); px[i + 3] = 255;
    }
  }
  return encodePNG(size, px);
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon-512.png'), drawIcon(512));
fs.writeFileSync(path.join(outDir, 'icon-192.png'), drawIcon(192));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), drawIcon(180));
console.log('Icons erzeugt: 512, 192, 180');
