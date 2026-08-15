#!/usr/bin/env node
// =============================================================================
//  make-icons.mjs — one-shot PWA icon generator.
//
//  Composites assets/Title.png onto the app's dark background, square, and
//  writes the icon sizes the manifest and iOS need. Run once; the PNGs are
//  committed.
//
//      node tools/make-icons.mjs
//
//  Dependency-free on purpose: this machine has no PIL / ImageMagick / ffmpeg,
//  and sips cannot flatten alpha onto a colour (it would leave the logo's
//  transparent interior black against the padded background). So this decodes
//  and re-encodes PNG directly using Node's built-in zlib.
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

const SRC = 'assets/Title.png';
const BG = [0x1a, 0x1d, 0x21];          // matches manifest background/theme
const LOGO_FIT = 0.88;                   // fraction of the icon width
const OUT = [
  ['assets/icon-192.png', 192],
  ['assets/icon-512.png', 512],
  ['assets/apple-touch-icon.png', 180],
];

// ---------------------------------------------------------------- PNG read --
function crcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
}
const CRC = crcTable();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8, ihdr = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        w: data.readUInt32BE(0), h: data.readUInt32BE(4),
        depth: data[8], color: data[9], interlace: data[12],
      };
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (!ihdr) throw new Error('no IHDR');
  if (ihdr.depth !== 8) throw new Error(`unsupported bit depth ${ihdr.depth}`);
  if (ihdr.interlace) throw new Error('interlaced PNG unsupported');
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.color];
  if (!channels) throw new Error(`unsupported colour type ${ihdr.color}`);

  const raw = inflateSync(Buffer.concat(idat));
  const { w, h } = ihdr;
  const bpp = channels;
  const stride = w * bpp;
  const out = Buffer.alloc(stride * h);

  // undo per-scanline filters
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++];
    const line = raw.subarray(rp, rp + stride); rp += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= bpp) ? prev[x - bpp] : 0;
      let v = line[x];
      switch (filter) {
        case 0: break;
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: {
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`bad filter ${filter}`);
      }
      cur[x] = v & 0xff;
    }
  }

  // normalise to RGBA
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const s = i * bpp, d = i * 4;
    if (channels === 4) { rgba[d] = out[s]; rgba[d + 1] = out[s + 1]; rgba[d + 2] = out[s + 2]; rgba[d + 3] = out[s + 3]; }
    else if (channels === 3) { rgba[d] = out[s]; rgba[d + 1] = out[s + 1]; rgba[d + 2] = out[s + 2]; rgba[d + 3] = 255; }
    else if (channels === 2) { rgba[d] = rgba[d + 1] = rgba[d + 2] = out[s]; rgba[d + 3] = out[s + 1]; }
    else { rgba[d] = rgba[d + 1] = rgba[d + 2] = out[s]; rgba[d + 3] = 255; }
  }
  return { w, h, rgba };
}

// --------------------------------------------------------------- PNG write --
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePNG(w, h, rgb) {          // rgb = RGB8, no alpha (icons are opaque)
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;           // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- build --
const src = decodePNG(readFileSync(SRC));

// tight alpha bounds, so the icon is framed on the artwork not the canvas
let x0 = src.w, y0 = src.h, x1 = 0, y1 = 0;
for (let y = 0; y < src.h; y++) {
  for (let x = 0; x < src.w; x++) {
    if (src.rgba[(y * src.w + x) * 4 + 3] > 16) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
}
const lw = x1 - x0 + 1, lh = y1 - y0 + 1;

// Master composite at 1024, then box-downsample to each target.
const M = 1024;
const master = Buffer.alloc(M * M * 3);
for (let i = 0; i < M * M; i++) { master[i * 3] = BG[0]; master[i * 3 + 1] = BG[1]; master[i * 3 + 2] = BG[2]; }

const scale = (M * LOGO_FIT) / lw;
const dw = Math.round(lw * scale), dh = Math.round(lh * scale);
const ox = Math.round((M - dw) / 2), oy = Math.round((M - dh) / 2);

for (let y = 0; y < dh; y++) {
  const sy = y0 + Math.min(lh - 1, Math.floor(y / scale));
  for (let x = 0; x < dw; x++) {
    const sx = x0 + Math.min(lw - 1, Math.floor(x / scale));
    const s = (sy * src.w + sx) * 4;
    const a = src.rgba[s + 3] / 255;
    if (a <= 0) continue;
    const d = ((oy + y) * M + (ox + x)) * 3;
    for (let k = 0; k < 3; k++) {
      master[d + k] = Math.round(src.rgba[s + k] * a + master[d + k] * (1 - a));
    }
  }
}

function downsample(srcBuf, from, to) {
  const out = Buffer.alloc(to * to * 3);
  const ratio = from / to;
  for (let y = 0; y < to; y++) {
    const sy0 = Math.floor(y * ratio), sy1 = Math.min(from, Math.ceil((y + 1) * ratio));
    for (let x = 0; x < to; x++) {
      const sx0 = Math.floor(x * ratio), sx1 = Math.min(from, Math.ceil((x + 1) * ratio));
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const s = (sy * from + sx) * 3;
          r += srcBuf[s]; g += srcBuf[s + 1]; b += srcBuf[s + 2]; n++;
        }
      }
      const d = (y * to + x) * 3;
      out[d] = Math.round(r / n); out[d + 1] = Math.round(g / n); out[d + 2] = Math.round(b / n);
    }
  }
  return out;
}

for (const [path, size] of OUT) {
  const px = size === M ? master : downsample(master, M, size);
  writeFileSync(path, encodePNG(size, size, px));
  console.log(`wrote ${path} (${size}x${size})`);
}
console.log(`source logo box ${lw}x${lh} at (${x0},${y0})`);
