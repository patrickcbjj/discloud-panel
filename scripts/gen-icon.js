// Gera build/icon.png 256x256 (cloud icon em fundo escuro) usando só Node built-ins.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const W = 256, H = 256;
const img = Buffer.alloc(H * (1 + W * 4));

// CRC32
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function getPx(x, y) {
  const off = y * (1 + W * 4) + 1 + x * 4;
  return [img[off], img[off+1], img[off+2], img[off+3]];
}
function setPx(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const off = y * (1 + W * 4) + 1 + x * 4;
  const aN = a / 255;
  img[off]   = Math.round(img[off]   * (1 - aN) + r * aN);
  img[off+1] = Math.round(img[off+1] * (1 - aN) + g * aN);
  img[off+2] = Math.round(img[off+2] * (1 - aN) + b * aN);
  img[off+3] = 255;
}

// Background: gradient escuro com canto arredondado
function inRounded(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || y < y0 || x > x1 || y > y1) return false;
  const cx = Math.max(x0 + r, Math.min(x1 - r, x));
  const cy = Math.max(y0 + r, Math.min(y1 - r, y));
  const dx = x - cx, dy = y - cy;
  return Math.sqrt(dx*dx + dy*dy) <= r;
}

for (let y = 0; y < H; y++) {
  img[y * (1 + W * 4)] = 0; // filter
  for (let x = 0; x < W; x++) {
    if (inRounded(x, y, 0, 0, W-1, H-1, 48)) {
      // gradiente vertical: #0b0d12 -> #1a1f2b
      const t = y / H;
      const r = Math.round(0x0b + (0x1a - 0x0b) * t);
      const g = Math.round(0x0d + (0x1f - 0x0d) * t);
      const b = Math.round(0x12 + (0x2b - 0x12) * t);
      setPx(x, y, r, g, b, 255);
    }
  }
}

// Nuvem com gradiente (accent #5b8def -> accent2 #7c5cff)
function filledCircle(cx, cy, rad) {
  for (let y = Math.max(0, cy-rad-1); y < Math.min(H, cy+rad+1); y++) {
    for (let x = Math.max(0, cx-rad-1); x < Math.min(W, cx+rad+1); x++) {
      const dx = x - cx, dy = y - cy;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d <= rad + 0.5) {
        const t = (y - 60) / 140;
        const r = Math.round(0x5b + (0x7c - 0x5b) * Math.max(0, Math.min(1, t)));
        const g = Math.round(0x8d + (0x5c - 0x8d) * Math.max(0, Math.min(1, t)));
        const b = Math.round(0xef + (0xff - 0xef) * Math.max(0, Math.min(1, t)));
        const edge = Math.max(0, Math.min(1, rad + 0.5 - d));
        setPx(x, y, r, g, b, Math.round(255 * edge));
      }
    }
  }
}

// Sombra suave embaixo da nuvem
for (let y = 175; y < 200; y++) {
  for (let x = 50; x < 210; x++) {
    const dy = y - 175;
    const a = Math.round(30 * (1 - dy / 25));
    setPx(x, y, 0, 0, 0, a);
  }
}

// Cloud puffs
filledCircle(96, 145, 38);
filledCircle(170, 145, 46);
filledCircle(132, 102, 44);

// Base achatada da nuvem
for (let y = 130; y < 175; y++) {
  for (let x = 62; x < 210; x++) {
    const t = (y - 60) / 140;
    const r = Math.round(0x5b + (0x7c - 0x5b) * Math.max(0, Math.min(1, t)));
    const g = Math.round(0x8d + (0x5c - 0x8d) * Math.max(0, Math.min(1, t)));
    const b = Math.round(0xef + (0xff - 0xef) * Math.max(0, Math.min(1, t)));
    setPx(x, y, r, g, b, 255);
  }
}

// Linha/setinha pra cima dentro da nuvem (indicando "monitor")
function rect(x0, y0, x1, y1, r, g, b, a = 255) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setPx(x, y, r, g, b, a);
}
// Mini chart bars
rect(95, 135, 105, 165, 255, 255, 255, 200);
rect(115, 125, 125, 165, 255, 255, 255, 230);
rect(135, 115, 145, 165, 255, 255, 255, 255);
rect(155, 130, 165, 165, 255, 255, 255, 220);

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crcInput = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, t, data, crc]);
}

const sig = Buffer.from([137,80,78,71,13,10,26,10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 6;   // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const idat = zlib.deflateSync(img);
const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0))
]);

const out = path.join(__dirname, '..', 'build', 'icon.png');
fs.writeFileSync(out, png);
console.log('Icon generated:', out, png.length, 'bytes');
