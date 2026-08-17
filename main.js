// =============================================================================
//  TRAFFIC SIMULATOR 3000
//  You are not going to make it on time.
//
//  Build order follows GDD §9:
//    1 scene  2 player  3 traffic  4 collision  5 touch  6 audio  7 hud  8 polish
//
//  All tuning lives in config.js. All art paths live in config.js ASSETS and
//  fall back to programmatic placeholders when the file is absent.
// =============================================================================

import * as THREE from 'three';
import { CFG, AUDIO, ASSETS, ATLAS, SEGMENT, STICKER, SEMI, FRONTS, COCKPIT, TOUCH, WORLD, SHARE, LANE, UNLOCKS, GPS, EMOTE, MPH, FT } from './config.js';

// ---------------------------------------------------------------- utilities --
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = n => (Math.random() * n) | 0;
const approach = (v, target, rate, dt) => {
  const d = target - v;
  const step = rate * dt;
  return Math.abs(d) <= step ? target : v + Math.sign(d) * step;
};

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// =============================================================================
//  ASSET LOADING
//  One lookup: if the file resolves, use it; otherwise hand back null and the
//  caller generates a placeholder with the identical layout.
// =============================================================================

function loadImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => { console.info(`[assets] missing "${url}" — using placeholder`); resolve(null); };
    img.src = url;
  });
}

const ART = {};   // populated in boot()

// =============================================================================
//  PROGRAMMATIC PLACEHOLDER ART
//  Every generator emits the SAME grid layout as the real atlas it stands in
//  for, so the slicing / UV / measurement code downstream has exactly one path.
// =============================================================================

const CAR_SHAPE = {
  //            bodyW  bodyH  roofW  roofH  roofY   wheelR
  sedan:  { bw: 0.86, bh: 0.30, rw: 0.66, rh: 0.20, ry: 0.30, wr: 0.075, tail: 0.115 },
  suv:    { bw: 0.88, bh: 0.36, rw: 0.78, rh: 0.28, ry: 0.36, wr: 0.085, tail: 0.100 },
  pickup: { bw: 0.90, bh: 0.38, rw: 0.72, rh: 0.26, ry: 0.38, wr: 0.092, tail: 0.105 },
  hatch:  { bw: 0.82, bh: 0.28, rw: 0.70, rh: 0.25, ry: 0.28, wr: 0.070, tail: 0.110 },
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255);
  const g = clamp(((n >>  8) & 255) + amt, 0, 255);
  const b = clamp(( n        & 255) + amt, 0, 255);
  return `rgb(${r|0},${g|0},${b|0})`;
}

// Draw one placeholder car, bottom-aligned, into a cell at (ox,oy,size).
function drawCarCell(ctx, ox, oy, size, type, hex, braking, view) {
  const S  = CAR_SHAPE[type];
  const cx = ox + size * 0.5;
  const gy = oy + size * 0.90;           // ground line
  const bw = size * S.bw;
  const bh = size * S.bh;
  const rw = size * S.rw;
  const rh = size * S.rh;
  const wr = size * S.wr;

  ctx.save();

  // slight horizontal squash + side slab for the 3/4 fallback views
  const threeQ = (view === 'l' || view === 'r');
  if (threeQ) {
    ctx.translate(cx, 0);
    ctx.scale(view === 'l' ? 0.80 : -0.80, 1);
    ctx.translate(-cx, 0);
  }

  // contact shadow
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(cx, gy + wr * 0.35, bw * 0.54, wr * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // wheels
  ctx.fillStyle = '#15161a';
  for (const s of [-1, 1]) {
    roundRect(ctx, cx + s * bw * 0.42 - wr, gy - wr * 1.5, wr * 2, wr * 2, wr * 0.45);
    ctx.fill();
  }

  const bodyTop = gy - wr * 0.6 - bh;

  // lower body
  const g = ctx.createLinearGradient(0, bodyTop, 0, gy);
  g.addColorStop(0,    shade(hex,  26));
  g.addColorStop(0.55, hex);
  g.addColorStop(1,    shade(hex, -34));
  ctx.fillStyle = g;
  roundRect(ctx, cx - bw / 2, bodyTop, bw, bh + wr * 0.6, size * 0.035);
  ctx.fill();

  // greenhouse
  const roofY = bodyTop - rh;
  ctx.fillStyle = shade(hex, -10);
  roundRect(ctx, cx - rw / 2, roofY, rw, rh + size * 0.03, size * 0.030);
  ctx.fill();

  // rear glass
  ctx.fillStyle = 'rgba(30,40,52,0.90)';
  roundRect(ctx, cx - rw * 0.44, roofY + rh * 0.16, rw * 0.88, rh * 0.66, size * 0.018);
  ctx.fill();

  // mirrors
  ctx.fillStyle = shade(hex, -46);
  for (const s of [-1, 1]) {
    roundRect(ctx, cx + s * (rw * 0.5) - (s < 0 ? size * 0.045 : 0),
              roofY + rh * 0.62, size * 0.045, size * 0.026, size * 0.008);
    ctx.fill();
  }

  // tail lights
  const tw = size * S.tail, th = size * 0.052;
  const ty = bodyTop + bh * 0.28;
  for (const s of [-1, 1]) {
    const tx = cx + s * (bw * 0.5 - tw * 0.55) - tw / 2;
    if (braking) {
      ctx.save();
      ctx.shadowColor = 'rgba(255,40,20,0.95)';
      ctx.shadowBlur  = size * 0.10;
      ctx.fillStyle   = '#ff2a14';
      roundRect(ctx, tx, ty, tw, th, size * 0.012); ctx.fill();
      ctx.fillStyle = '#ffd2c8';
      roundRect(ctx, tx + tw * 0.2, ty + th * 0.22, tw * 0.6, th * 0.45, size * 0.008); ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = '#6e1414';
      roundRect(ctx, tx, ty, tw, th, size * 0.012); ctx.fill();
    }
  }

  // third brake light
  if (braking) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,40,20,0.9)';
    ctx.shadowBlur  = size * 0.07;
    ctx.fillStyle   = '#ff3018';
    roundRect(ctx, cx - rw * 0.16, roofY + rh * 0.02, rw * 0.32, size * 0.020, size * 0.006);
    ctx.fill();
    ctx.restore();
  }

  // plate
  ctx.fillStyle = '#dcdcd2';
  const pw = size * 0.13, ph = size * 0.055;
  roundRect(ctx, cx - pw / 2, bodyTop + bh * 0.62, pw, ph, size * 0.006);
  ctx.fill();

  // bumper
  ctx.fillStyle = shade(hex, -58);
  roundRect(ctx, cx - bw * 0.5, gy - wr * 1.0, bw, size * 0.045, size * 0.010);
  ctx.fill();

  ctx.restore();
}

// 8 x 4 placeholder standing in for cars_atlas.png / cars_atlas_34.png
function buildCarAtlasPlaceholder(view) {
  const W = 1774, H = 887;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const cw = W / ATLAS.COLS, ch = H / ATLAS.ROWS;
  for (let r = 0; r < ATLAS.ROWS; r++) {
    for (let ci = 0; ci < ATLAS.COLORS.length; ci++) {
      const col = ATLAS.COLORS[ci];
      for (let b = 0; b < 2; b++) {
        const x = Math.round((col.col + b) * cw);
        const y = Math.round(r * ch);
        const size = Math.min(Math.round(cw), Math.round(ch));
        drawCarCell(ctx, x, y, size, ATLAS.ROWS_DEF[r].type, col.hex, b === 1, view);
      }
    }
  }
  return c;
}

// 2 x 1 placeholder standing in for semi_atlas.png
function buildSemiAtlasPlaceholder() {
  const W = 1774, H = 887;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const cw = W / 2;
  for (let b = 0; b < 2; b++) {
    const ox = Math.round(b * cw), size = Math.round(cw);
    const x0 = ox + size * 0.20, w = size * 0.60;
    const y0 = size * 0.06,      h = size * 0.68;

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(ox + size * 0.5, size * 0.90, w * 0.55, size * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();

    // trailer box
    const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, '#c9c4b6'); g.addColorStop(0.5, '#e2ddd0'); g.addColorStop(1, '#b5b0a2');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = '#6d675e'; ctx.lineWidth = size * 0.010;
    ctx.strokeRect(x0, y0, w, h);

    // door split + hinges
    ctx.fillStyle = '#8d887c';
    ctx.fillRect(ox + size * 0.5 - size * 0.006, y0, size * 0.012, h);
    for (let i = 0; i < 5; i++) {
      const hy = y0 + h * (0.1 + i * 0.2);
      ctx.fillRect(x0 + w * 0.02, hy, w * 0.06, h * 0.035);
      ctx.fillRect(x0 + w * 0.92, hy, w * 0.06, h * 0.035);
    }

    // conspicuity tape
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#d8d3c6' : '#c8261d';
      ctx.fillRect(x0 + (w / 12) * i, y0 + h - size * 0.024, w / 12, size * 0.024);
    }

    // mud flaps + underride bar
    ctx.fillStyle = '#232326';
    ctx.fillRect(x0 + w * 0.04, y0 + h, w * 0.20, size * 0.13);
    ctx.fillRect(x0 + w * 0.76, y0 + h, w * 0.20, size * 0.13);
    ctx.fillStyle = '#5b5b5f';
    ctx.fillRect(x0 + w * 0.10, y0 + h + size * 0.115, w * 0.80, size * 0.022);

    // lamps
    for (const s of [-1, 1]) {
      const lx = ox + size * 0.5 + s * w * 0.40;
      const ly = y0 + h + size * 0.035;
      if (b === 1) {
        ctx.save();
        ctx.shadowColor = 'rgba(255,40,20,0.95)'; ctx.shadowBlur = size * 0.05;
        ctx.fillStyle = '#ff2a14';
      } else {
        ctx.fillStyle = '#6e1414';
      }
      ctx.beginPath(); ctx.arc(lx, ly, size * 0.022, 0, Math.PI * 2); ctx.fill();
      if (b === 1) ctx.restore();
    }
    // marker lights along the top
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = '#e0741f';
      ctx.fillRect(x0 + w * (0.12 + i * 0.19), y0 - size * 0.014, w * 0.07, size * 0.018);
    }
  }
  return c;
}

// 3 x 2 placeholder standing in for fronts_atlas.png (rearview mirror only)
function buildFrontsAtlasPlaceholder() {
  const cell = 444, W = cell * FRONTS.COLS, H = cell * FRONTS.ROWS;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const hexes = { sedan: '#c9ccd0', suv: '#eef0f1', pickup: '#7d1c22', hatch: '#243a66', semi: '#e8e4d8' };
  FRONTS.ORDER.forEach((type, i) => {
    const ox = (i % FRONTS.COLS) * cell, oy = ((i / FRONTS.COLS) | 0) * cell;
    const hex = hexes[type];
    const isSemi = type === 'semi';
    const bw = cell * (isSemi ? 0.68 : 0.80);
    const bh = cell * (isSemi ? 0.62 : 0.34);
    const cx = ox + cell * 0.5, gy = oy + cell * 0.88;
    const top = gy - bh;

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(cx, gy + cell * 0.02, bw * 0.54, cell * 0.028, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#15161a';
    for (const s of [-1, 1]) {
      roundRect(ctx, cx + s * bw * 0.40 - cell * 0.05, gy - cell * 0.09, cell * 0.10, cell * 0.11, cell * 0.03);
      ctx.fill();
    }
    const g = ctx.createLinearGradient(0, top, 0, gy);
    g.addColorStop(0, shade(hex, 24)); g.addColorStop(1, shade(hex, -30));
    ctx.fillStyle = g;
    roundRect(ctx, cx - bw / 2, top, bw, bh, cell * 0.03); ctx.fill();

    // windshield
    ctx.fillStyle = 'rgba(34,46,60,0.9)';
    roundRect(ctx, cx - bw * 0.40, top + bh * 0.08, bw * 0.80, bh * (isSemi ? 0.30 : 0.36), cell * 0.02);
    ctx.fill();
    // grille
    ctx.fillStyle = '#26262a';
    roundRect(ctx, cx - bw * 0.28, top + bh * (isSemi ? 0.52 : 0.56), bw * 0.56, bh * 0.20, cell * 0.012);
    ctx.fill();
    // headlights
    ctx.fillStyle = '#f2eddc';
    for (const s of [-1, 1]) {
      roundRect(ctx, cx + s * bw * 0.34 - cell * 0.045, top + bh * (isSemi ? 0.54 : 0.52),
                cell * 0.09, cell * 0.045, cell * 0.014);
      ctx.fill();
    }
  });
  return c;
}

// =============================================================================
//  ATLAS PREPARATION
//  - fractional 221.75px slicing (never assume an integer cell)
//  - clean bumper-sticker stamp over the AI gibberish
//  - per-cell alpha bounding boxes -> real-world quad sizing + ground alignment
//  - shared pair window so the brake toggle cannot "jump"
// =============================================================================

function sliceEdges(total, n) {
  const e = [];
  for (let i = 0; i <= n; i++) e.push(Math.round(i * total / n));
  return e;
}

function alphaBBox(data, W, x0, y0, x1, y1, threshold) {
  let minX = x1, minY = y1, maxX = x0 - 1, maxY = y0 - 1;
  for (let y = y0; y < y1; y++) {
    const row = y * W;
    for (let x = x0; x < x1; x++) {
      if (data[((row + x) << 2) + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return null;
  return { x0: minX, y0: minY, x1: maxX + 1, y1: maxY + 1, w: maxX + 1 - minX, h: maxY + 1 - minY };
}

// Repaint the dark-red sedan's bumper sticker with legible text (both cells).
// Coordinates are fractions of that sprite's MEASURED body box, so the stamp
// tracks the art even though the sheet is not a uniform grid.
function stampSticker(ctx, cells) {
  const r = STICKER.rect;
  for (const idx of STICKER.cols) {
    const cell = cells[STICKER.row * 8 + idx];
    if (!cell || !cell.core) continue;
    const b = cell.core;
    const x = b.x0 + r.x * b.w, y = b.y0 + r.y * b.h;
    const w = r.w * b.w,        h = r.h * b.h;

    ctx.save();
    ctx.fillStyle = STICKER.paper;
    roundRect(ctx, x, y, w, h, h * 0.18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = Math.max(1, h * 0.08);
    ctx.stroke();

    ctx.fillStyle = STICKER.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let fs = h * 0.70;
    do {
      ctx.font = `700 ${fs}px ui-sans-serif, Helvetica, Arial, sans-serif`;
      if (ctx.measureText(STICKER.text).width <= w * 0.92) break;
      fs -= 0.5;
    } while (fs > 3);
    ctx.fillText(STICKER.text, x + w / 2, y + h * 0.54);
    ctx.restore();
  }
}

// -----------------------------------------------------------------------------
//  CONTENT SEGMENTATION
//  Two of the supplied sheets are not uniform grids (see config.js SEGMENT), so
//  cells are found from the alpha channel: row bands, then column runs inside
//  each band, splitting any run that merged two touching sprites.
// -----------------------------------------------------------------------------

function findRuns(cov, n, threshold) {
  const out = [];
  let s = -1;
  for (let i = 0; i < n; i++) {
    const on = cov[i] > threshold;
    if (on && s < 0) s = i;
    if ((!on || i === n - 1) && s >= 0) { out.push([s, on ? i : i - 1]); s = -1; }
  }
  return out;
}

// Split merged runs until we have `want` of them. Each pass picks the run with
// the deepest interior coverage valley — that is the one holding two sprites,
// which is more reliable than simply picking the widest.
function splitToCount(runs, cov, want) {
  const out = runs.map(r => r.slice());
  let guard = 0;
  while (out.length < want && guard++ < 32) {
    let best = -1, bestScore = Infinity, bestAt = -1;
    for (let i = 0; i < out.length; i++) {
      const [a, b] = out[i];
      const span = b - a;
      if (span < 12) continue;
      const lo = a + Math.floor(span * 0.22), hi = b - Math.floor(span * 0.22);
      let mv = Infinity, mi = -1;
      for (let x = lo; x <= hi; x++) if (cov[x] < mv) { mv = cov[x]; mi = x; }
      let peak = 0;
      for (let x = a; x <= b; x++) if (cov[x] > peak) peak = cov[x];
      const score = mv / Math.max(peak, 1);   // normalised valley depth
      if (score < bestScore) { bestScore = score; best = i; bestAt = mi; }
    }
    if (best < 0) break;
    const [a, b] = out[best];
    out.splice(best, 1, [a, Math.max(a, bestAt - 1)], [Math.min(b, bestAt + 1), b]);
  }
  return out;
}

/**
 * Segment a sprite sheet into cells by alpha content.
 * Returns cells in row-major order, each with its `glow` box (includes the
 * brake halo), `core` box (solid body only) and the column `run` it came from.
 */
function segmentSheet(canvas, rows, perRow) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, W, H).data;
  const EDGE = SEGMENT.ALPHA_EDGE, CORE = SEGMENT.ALPHA_CORE;
  const A = (x, y) => data[((y * W + x) << 2) + 3];

  const rowCov = new Int32Array(H);
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) if (A(x, y) > EDGE) n++;
    rowCov[y] = n;
  }
  let bands = findRuns(rowCov, H, W * 0.002).filter(b => b[1] - b[0] > H * 0.04);
  // keep the `rows` tallest bands, back in top-to-bottom order
  if (bands.length > rows) {
    bands = bands.sort((p, q) => (q[1] - q[0]) - (p[1] - p[0])).slice(0, rows).sort((p, q) => p[0] - q[0]);
  }

  const cells = [];
  bands.forEach((band, ri) => {
    const [y0, y1] = band;
    const colCov = new Int32Array(W);
    for (let x = 0; x < W; x++) {
      let n = 0;
      for (let y = y0; y <= y1; y++) if (A(x, y) > EDGE) n++;
      colCov[x] = n;
    }
    const want = perRow[ri] !== undefined ? perRow[ri] : perRow[0];
    let runs = findRuns(colCov, W, (y1 - y0) * 0.012).filter(b => b[1] - b[0] > W * 0.004);
    runs = splitToCount(runs, colCov, want);
    runs.sort((p, q) => p[0] - q[0]);

    runs.forEach(([x0, x1], ci) => {
      // safe sampling limit: never reach past the midpoint to a neighbour
      const prev = ci > 0 ? runs[ci - 1][1] : -1;
      const next = ci < runs.length - 1 ? runs[ci + 1][0] : W;
      cells.push({
        row: ri, col: ci,
        run: [x0, x1],
        limit: [Math.floor((prev + x0) / 2) + 1, Math.ceil((x1 + next) / 2) - 1],
        band: [y0, y1],
        glow: alphaBBox(data, W, x0, y0, x1 + 1, y1 + 1, EDGE),
        core: alphaBBox(data, W, x0, y0, x1 + 1, y1 + 1, CORE),
      });
    });
  });
  return cells;
}

/**
 * Turn segmented cells into renderable variants.
 * Quad size comes from each sprite's own measured body box matched to a real
 * world width, which normalises the mixed scales in the 3/4 sheet. Within a
 * brake pair both frames get an identical window anchored on the CORE box, so
 * toggling the lights cannot shift the sprite.
 */
function buildCarVariants(canvas, cells, { turned = false } = {}) {
  const W = canvas.width, H = canvas.height;
  const inset = SEGMENT.UV_INSET_PX;
  const variants = [];

  for (let r = 0; r < ATLAS.ROWS; r++) {
    const rowDef = ATLAS.ROWS_DEF[r];
    if (!rowDef) continue;
    // Only meaningful for the rear view; turned sprites are fitted by height.
    const realW = rowDef.width;

    ATLAS.COLORS.forEach((colour, ci) => {
      const off = cells.find(c => c.row === r && c.col === ci * 2);
      const on  = cells.find(c => c.row === r && c.col === ci * 2 + 1);
      if (!off || !off.core || !off.glow) return;
      const pair = [off, on && on.core && on.glow ? on : off];

      // shared padding around the body box, max across the pair
      let padL = 0, padR = 0, padT = 0, padB = 0;
      for (const c of pair) {
        padL = Math.max(padL, c.core.x0 - c.glow.x0);
        padR = Math.max(padR, c.glow.x1 - c.core.x1);
        padT = Math.max(padT, c.core.y0 - c.glow.y0);
        padB = Math.max(padB, c.glow.y1 - c.core.y1);
      }
      const coreW = off.core.w, coreH = off.core.h;
      const winW = padL + coreW + padR, winH = padT + coreH + padB;

      // Fit the measured body box to the world table. Using width alone lets a
      // bad art scale blow a vehicle up to 2-3x its neighbours.
      //
      // Rear view: fit both axes (geometric mean) — the silhouette is
      // yaw-invariant so width and height should agree, and disagreement is
      // art error worth splitting.
      // Turned view: fit HEIGHT ONLY. The 3/4 sheet draws each colour at a
      // slightly different yaw, which legitimately changes projected width but
      // never roof height. Fitting width here would make identical cars
      // different sizes.
      const sW = coreW / realW, sH = coreH / rowDef.height;
      const pxPerM = turned ? sH : Math.sqrt(sW * sH);
      const skew = Math.abs(sW / sH - 1);
      if (!turned && skew > 0.12) {
        console.warn(`[assets] ${rowDef.type}/${colour.name}: art aspect off by ` +
                     `${(skew * 100).toFixed(0)}% vs the world table — fitted to the mean`);
      }

      const uv = pair.map(c => {
        let x0 = c.core.x0 - padL, y0 = c.core.y0 - padT;
        x0 = clamp(x0, c.limit[0] + inset, c.limit[1] - winW - inset);
        y0 = clamp(y0, inset, H - winH - inset);
        return {
          offset: [x0 / W, 1 - (y0 + winH) / H],
          repeat: [winW / W, winH / H],
          // distance from the window's bottom edge up to the tyre contact patch
          footPx: (y0 + winH) - c.core.y1,
        };
      });

      const planeW = winW / pxPerM, planeH = winH / pxPerM;
      variants.push({
        type: rowDef.type, colour: colour.name,
        width: rowDef.width, height: rowDef.height, length: rowDef.length,
        planeW, planeH,
        // distance from the plane's bottom edge up to the tyre contact patch
        footOffset: uv[0].footPx / pxPerM,
        uv,
      });
    });
  }
  return variants;
}

// Build a single-sprite variant (semi truck) from two segmented cells.
function buildPairVariant(canvas, cells, realWidth, meta) {
  const W = canvas.width, H = canvas.height;
  const inset = SEGMENT.UV_INSET_PX;
  const off = cells[0], on = cells[1] || cells[0];
  let padL = 0, padR = 0, padT = 0, padB = 0;
  for (const c of [off, on]) {
    padL = Math.max(padL, c.core.x0 - c.glow.x0);
    padR = Math.max(padR, c.glow.x1 - c.core.x1);
    padT = Math.max(padT, c.core.y0 - c.glow.y0);
    padB = Math.max(padB, c.glow.y1 - c.core.y1);
  }
  const winW = padL + off.core.w + padR, winH = padT + off.core.h + padB;
  const sW = off.core.w / realWidth, sH = off.core.h / (meta.height || realWidth);
  const pxPerM = Math.sqrt(sW * sH);
  const uv = [off, on].map(c => {
    const x0 = clamp(c.core.x0 - padL, c.limit[0] + inset, c.limit[1] - winW - inset);
    const y0 = clamp(c.core.y0 - padT, inset, H - winH - inset);
    return {
      offset: [x0 / W, 1 - (y0 + winH) / H],
      repeat: [winW / W, winH / H],
      footPx: (y0 + winH) - c.core.y1,
    };
  });
  const planeW = winW / pxPerM, planeH = winH / pxPerM;
  return Object.assign({
    planeW, planeH,
    footOffset: uv[0].footPx / pxPerM,
    uv,
  }, meta);
}

function textureFrom(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace    = THREE.SRGBColorSpace;
  t.minFilter     = THREE.LinearMipmapLinearFilter;
  t.magFilter     = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy    = 4;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// =============================================================================
//  SCENE
// =============================================================================

const HAZE = 0xb9c6cf;

let renderer, scene, camera;
const world = {};

// Average colour of a horizontal band, ignoring transparent pixels.
function avgBandColor(canvas, y0, y1) {
  const W = canvas.width;
  const h = Math.max(1, y1 - y0);
  const d = canvas.getContext('2d', { willReadFrequently: true })
                  .getImageData(0, y0, W, h).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 32) continue;
    r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
  }
  if (!n) return null;
  return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
}

// Flat sky gradient. The hills/pylons/skyline come from the real backdrop
// strip, so this is only the wash behind them — and its colours are sampled
// FROM that strip so the two planes meet without a visible seam.
function buildSkyGradient(topCol, midCol) {
  const c = makeCanvas(64, 512), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.00, topCol || WORLD.SKY_TOP);
  g.addColorStop(0.62, midCol || '#8fb6d6');
  g.addColorStop(0.90, WORLD.SKY_HAZE);
  g.addColorStop(1.00, WORLD.SKY_HAZE);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 512);
  return c;
}

// Fallback sky, with hills painted in, used only if Freeway_Wall.png is absent.
function buildSkyWithHills() {
  const c = makeCanvas(1024, 512), ctx = c.getContext('2d');
  ctx.drawImage(buildSkyGradient(), 0, 0, 1024, 512);
  for (let layer = 0; layer < 3; layer++) {
    const base = 352 + layer * 16, amp = 46 - layer * 12;
    ctx.beginPath();
    ctx.moveTo(0, 512); ctx.lineTo(0, base);
    for (let x = 0; x <= 1024; x += 16) {
      ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * 0.0075 + layer * 2.1))
                       - amp * 0.35 * Math.sin(x * 0.021 + layer));
    }
    ctx.lineTo(1024, 512); ctx.closePath();
    ctx.fillStyle = ['rgba(126,146,150,0.55)', 'rgba(140,156,158,0.55)', 'rgba(158,170,170,0.6)'][layer];
    ctx.fill();
  }
  return c;
}

/**
 * Split Freeway_Wall.png into its stacked strips (backdrop / sound wall /
 * guardrail). Separators are blank rows: either fully transparent, or the
 * near-white gaps the sheet uses between strips.
 */
function detectStrips(img) {
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = makeCanvas(W, H), ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, W, H).data;

  const blank = new Uint8Array(H);
  for (let y = 0; y < H; y++) {
    let sum = 0, sum2 = 0, alpha = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) << 2;
      const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
      sum += v; sum2 += v * v; alpha += d[i + 3];
    }
    const m = sum / W, sd = Math.sqrt(Math.max(0, sum2 / W - m * m));
    blank[y] = ((alpha / W) < 20 || (m > 232 && sd < 14)) ? 1 : 0;
  }

  const strips = [];
  let s = -1;
  for (let y = 0; y < H; y++) {
    if (!blank[y] && s < 0) s = y;
    if ((blank[y] || y === H - 1) && s >= 0) {
      const e = blank[y] ? y - 1 : y;
      if (e - s > H * 0.03) strips.push([s, e]);
      s = -1;
    }
  }
  return strips.map(([y0, y1]) => {
    const h = y1 - y0 + 1;
    const sc = makeCanvas(W, h);
    sc.getContext('2d').drawImage(c, 0, y0, W, h, 0, 0, W, h);
    return { canvas: sc, w: W, h };
  });
}

/**
 * Road surface. Street_Texture.png cell 0 is plain asphalt (cell 1 carries a
 * dashed line at ~4 m spacing, which is too frequent). We tile the plain cell
 * and draw the markings ourselves at a correct 3 m stripe / 9 m gap.
 * Mirrored horizontally so the tile has no vertical seam; stacked vertically
 * unmirrored because the source is already seamless top-to-bottom.
 */
function buildRoadTexture(img) {
  const TILE = 1024;
  const c = makeCanvas(TILE, TILE), ctx = c.getContext('2d');

  if (img) {
    const cellW = img.naturalWidth / 2;
    const ins = WORLD.ROAD_SEAM_INSET_PX;
    const sx = ins, sw = Math.round(cellW) - ins * 2;
    const sy = ins, sh = img.naturalHeight - ins * 2;
    const COLS = 3, ROWS = 3;
    const tw = TILE / COLS, th = TILE / ROWS;
    for (let ry = 0; ry < ROWS; ry++) {
      for (let rx = 0; rx < COLS; rx++) {
        ctx.save();
        ctx.translate(rx * tw + (rx % 2 ? tw : 0), ry * th);
        ctx.scale(rx % 2 ? -1 : 1, 1);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);
        ctx.restore();
      }
    }
  } else {
    ctx.fillStyle = '#4c4f52'; ctx.fillRect(0, 0, TILE, TILE);
    const id = ctx.getImageData(0, 0, TILE, TILE), dd = id.data;
    for (let i = 0; i < dd.length; i += 4) {
      const n = (Math.random() * 34) | 0;
      dd[i] += n - 17; dd[i + 1] += n - 17; dd[i + 2] += n - 17;
    }
    ctx.putImageData(id, 0, 0);
  }

  // --- markings ------------------------------------------------------------
  const pxX = TILE / WORLD.ROAD_WIDTH_M;
  const pxY = TILE / WORLD.ROAD_TILE_M;
  const mid = TILE / 2;
  const lw  = Math.max(2, WORLD.LINE_W_M * pxX);

  // solid edges: yellow on the median (left), white on the shoulder (right)
  ctx.fillStyle = WORLD.EDGE_LEFT;
  ctx.fillRect(mid - (CFG.LANE_WIDTH * 1.5 + 0.25) * pxX, 0, lw, TILE);
  ctx.fillStyle = WORLD.EDGE_RIGHT;
  ctx.fillRect(mid + (CFG.LANE_WIDTH * 1.5 + 0.25) * pxX - lw, 0, lw, TILE);

  // dashed lane boundaries
  ctx.fillStyle = WORLD.DASH_COLOR;
  const dashPx = WORLD.DASH_LEN_M * pxY, periodPx = WORLD.DASH_PERIOD_M * pxY;
  for (const side of [-1, 1]) {
    const x = mid + side * (CFG.LANE_WIDTH * 0.5) * pxX - lw / 2;
    for (let y = 0; y < TILE; y += periodPx) ctx.fillRect(x, y, lw, dashPx);
  }
  return c;
}

function buildWallTexture() {
  const W = 512, H = 256;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#c3bdb0'); g.addColorStop(0.55, '#aaa498'); g.addColorStop(1, '#8f8a80');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(90,86,78,0.85)'; ctx.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { const x = i * W / 4; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  ctx.fillStyle = 'rgba(70,66,60,0.18)';
  for (let i = 0; i < 90; i++) ctx.fillRect(Math.random() * W, Math.random() * H, rand(3, 26), rand(2, 12));
  return c;
}

function buildGuardrailTexture() {
  const W = 256, H = 128;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, H * 0.30, 0, H * 0.70);
  g.addColorStop(0, '#b9bcbe'); g.addColorStop(0.35, '#8e9295');
  g.addColorStop(0.5, '#cbced0'); g.addColorStop(0.65, '#8e9295'); g.addColorStop(1, '#7c8083');
  ctx.fillStyle = g; ctx.fillRect(0, H * 0.30, W, H * 0.40);
  ctx.fillStyle = '#7b7f82';
  ctx.fillRect(W * 0.12, H * 0.30, 12, H * 0.70);
  ctx.fillRect(W * 0.62, H * 0.30, 12, H * 0.70);
  return c;
}

function buildSignTexture() {
  const W = 1024, H = 512;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#8b9095';
  ctx.fillRect(W * 0.03, H * 0.16, W * 0.02, H * 0.84);
  ctx.fillRect(W * 0.95, H * 0.16, W * 0.02, H * 0.84);
  ctx.fillRect(0, H * 0.16, W, H * 0.05);
  ctx.fillStyle = '#1f6b3a';
  roundRect(ctx, W * 0.28, H * 0.06, W * 0.44, H * 0.34, 12); ctx.fill();
  ctx.strokeStyle = '#f0f0ea'; ctx.lineWidth = 5;
  roundRect(ctx, W * 0.30, H * 0.08, W * 0.40, H * 0.30, 10); ctx.stroke();
  ctx.fillStyle = '#f4f4ee'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 62px ui-sans-serif, Helvetica, Arial, sans-serif';
  ctx.fillText('EXIT 12', W / 2, H * 0.17);
  ctx.font = '600 42px ui-sans-serif, Helvetica, Arial, sans-serif';
  ctx.fillText('1 MILE', W / 2, H * 0.31);
  return c;
}

function scrollTex(canvas, mirrored) {
  const t = textureFrom(canvas);
  t.wrapS = mirrored ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function buildScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(WORLD.SKY_HAZE);
  scene.fog = new THREE.Fog(new THREE.Color(WORLD.SKY_HAZE).getHex(), CFG.FOG_NEAR, CFG.FOG_FAR);

  camera = new THREE.PerspectiveCamera(CFG.FOV, 1, 0.1, 1600);
  camera.position.set(CFG.CAMERA_SEAT_OFFSET_X, CFG.CAMERA_HEIGHT, 0);

  const strips = ART.wall ? detectStrips(ART.wall) : [];
  const haveStrips = strips.length >= 3;
  if (ART.wall && !haveStrips) {
    console.warn(`[assets] Freeway_Wall.png: expected 3 stacked strips, found ${strips.length} — using placeholders`);
  }

  // --- sky wash (always) ---------------------------------------------------
  // Match the wash to the backdrop strip's own sky so the join is invisible.
  let skyTop = null, skyMid = null;
  if (haveStrips) {
    const bd = strips[0].canvas;
    skyTop = avgBandColor(bd, 0, Math.max(2, Math.round(bd.height * 0.06)));
    skyMid = avgBandColor(bd, Math.round(bd.height * 0.06), Math.round(bd.height * 0.20));
  }
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 1400),
    new THREE.MeshBasicMaterial({
      map: textureFrom(haveStrips ? buildSkyGradient(skyTop, skyMid) : buildSkyWithHills()),
      fog: false, depthWrite: false,
    })
  );
  sky.position.set(0, 340, -900);
  sky.renderOrder = -20;
  scene.add(sky);

  // --- distant backdrop strip: hills, pylons, billboards, skyline ----------
  if (haveStrips) {
    const s = strips[0];
    const tileW = WORLD.BACKDROP_HEIGHT_M * (s.w / s.h);
    const tex = scrollTex(s.canvas, true);
    tex.repeat.set(WORLD.BACKDROP_REPEAT, 1);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(tileW * WORLD.BACKDROP_REPEAT, WORLD.BACKDROP_HEIGHT_M),
      new THREE.MeshBasicMaterial({ map: tex, fog: false, transparent: true, depthWrite: false })
    );
    mesh.position.set(0, WORLD.BACKDROP_HEIGHT_M / 2, WORLD.BACKDROP_Z);
    mesh.renderOrder = -15;
    scene.add(mesh);
    world.backdropTex = tex;
    world.backdropTileW = tileW;
  }

  // --- ground --------------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 1600),
    new THREE.MeshBasicMaterial({ color: 0x9a9179 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, -500);
  scene.add(ground);

  // --- road ----------------------------------------------------------------
  const roadTex = textureFrom(buildRoadTexture(ART.road));
  roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.wrapS = THREE.ClampToEdgeWrapping;
  roadTex.repeat.set(1, 1400 / WORLD.ROAD_TILE_M);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.ROAD_WIDTH_M, 1400),
    new THREE.MeshBasicMaterial({ map: roadTex })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, -500);
  scene.add(road);
  world.roadTex = roadTex;

  // --- sound wall, right ---------------------------------------------------
  {
    const s = haveStrips ? strips[1] : null;
    const canvas = s ? s.canvas : buildWallTexture();
    const aspect = s ? (s.w / s.h) : 2;
    const tileW = WORLD.WALL_HEIGHT_M * aspect;
    const tex = scrollTex(canvas, false);
    tex.repeat.set(1400 / tileW, 1);
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, WORLD.WALL_HEIGHT_M),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.2 })
    );
    wall.rotation.y = Math.PI / 2;
    wall.position.set(WORLD.WALL_X, WORLD.WALL_HEIGHT_M / 2, -500);
    scene.add(wall);
    world.wallTex = tex;
    world.wallTileW = tileW;
  }

  // --- guardrail, left -----------------------------------------------------
  {
    const s = haveStrips ? strips[2] : null;
    const canvas = s ? s.canvas : buildGuardrailTexture();
    const aspect = s ? (s.w / s.h) : 2;
    const tileW = WORLD.RAIL_HEIGHT_M * aspect;
    const tex = scrollTex(canvas, false);
    tex.repeat.set(1400 / tileW, 1);
    const rail = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, WORLD.RAIL_HEIGHT_M),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.28 })
    );
    rail.rotation.y = Math.PI / 2;
    rail.position.set(WORLD.RAIL_X, WORLD.RAIL_HEIGHT_M / 2, -500);
    scene.add(rail);
    world.railTex = tex;
    world.railTileW = tileW;
  }

  // --- sign gantry: forever one mile away ----------------------------------
  {
    const canvas = ART.sign || buildSignTexture();
    const w = ART.sign ? ART.sign.naturalWidth : canvas.width;
    const h = ART.sign ? ART.sign.naturalHeight : canvas.height;
    const tex = ART.sign ? textureFrom((() => {
      const c = makeCanvas(w, h); c.getContext('2d').drawImage(ART.sign, 0, 0); return c;
    })()) : textureFrom(canvas);
    const planeW = WORLD.SIGN_WIDTH_M, planeH = planeW * (h / w);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(planeW, planeH),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide })
    );
    sign.position.y = planeH / 2;
    scene.add(sign);
    world.gantry = sign;
    world.gantryS = WORLD.SIGN_START_S;
  }
}

// =============================================================================
//  TRAFFIC
// =============================================================================

const lanes = [];        // lanes[i].cars = array sorted by s DESCENDING (0 = frontmost)
let carAtlas = null;     // { texture, variants[] }
let car34Atlas = null;
let semiAtlas = null;

function laneX(i) { return (i - (CFG.LANE_COUNT - 1) / 2) * CFG.LANE_WIDTH; }

// unit quad for wall-scrape decals (scaled per streak)
const UNIT_DECAL = new THREE.PlaneGeometry(1, 1);

/**
 * Bottom-anchored plane for a variant, built once and cached on it.
 * The geometry is translated so the sprite's TYRE LINE sits at local y=0, so
 * every mesh is simply placed at world y=0 and can never float or sink. Sizing
 * is baked into the geometry — no mesh.scale, no screen-space scaling anywhere.
 */
function variantGeometry(variant) {
  if (!variant.__geom) {
    const g = new THREE.PlaneGeometry(variant.planeW, variant.planeH);
    g.translate(0, variant.planeH / 2 - variant.footOffset, 0);
    variant.__geom = g;
  }
  return variant.__geom;
}

function cloneAtlasTexture(atlas) {
  const t = atlas.texture.clone();   // shares .source — no second GPU upload
  t.needsUpdate = true;
  return t;
}

function spawnCar(laneIndex, s, forceSemi = false) {
  const isSemi = forceSemi;
  let variant, v34 = null, tex34 = null;

  if (isSemi) {
    variant = semiAtlas.variant;
  } else {
    variant = carAtlas.variants[randi(carAtlas.variants.length)];
    if (car34Atlas) {
      v34 = car34Atlas.byKey[variant.type + '|' + variant.colour] || null;
      if (v34) tex34 = cloneAtlasTexture(car34Atlas);
    }
  }

  const texRear = cloneAtlasTexture(isSemi ? semiAtlas : carAtlas);
  const mat = new THREE.MeshBasicMaterial({
    map: texRear, transparent: true, alphaTest: CFG.SPRITE_ALPHA_TEST, depthWrite: true,
  });
  const mesh = new THREE.Mesh(variantGeometry(variant), mat);
  scene.add(mesh);

  return {
    lane: laneIndex,
    s,
    speed: 0,
    accel: 0,
    braking: true,
    isSemi,
    variant,          // rear-view variant
    v34,              // rear-3/4 variant, or null when that atlas is absent
    texRear, tex34,
    mesh, mat,
    brakeFrame: -1,
    viewMode: -1,     // 0 = rear, 1 = rear-3/4 (mirrored in U for the left lane)
    honkCooldown: rand(0, 2),
    len: isSemi ? SEMI.length : variant.length,
    wid: isSemi ? SEMI.width  : variant.width,
    // JEFF PASS: adjacent-lane gap character. Mostly just-too-small, with the
    // occasional real chance (LANE.GAP_FAIR_CHANCE).
    gapMult: Math.random() < LANE.GAP_FAIR_CHANCE ? LANE.GAP_FAIR_MULT : LANE.GAP_TIGHT_MULT,
    tailgateUntil: 0,  // emote fallout: tighter following for a while
    brakeMult: 1,      // emote fallout: harsher brake slams
    denyUntil: 0,      // saw your blinker; currently shutting the gap
  };
}

function disposeCar(car) {
  scene.remove(car.mesh);
  car.mat.dispose();
  car.texRear.dispose();
  if (car.tex34) car.tex34.dispose();
}

function buildTraffic() {
  lanes.length = 0;
  for (let i = 0; i < CFG.LANE_COUNT; i++) {
    lanes.push({
      index: i,
      cars: [],
      leadTarget: 0,
      state: 'crawl',
      waveTimer: rand(2, CFG.WAVE_INTERVAL_MAX),
      surgeTimer: 0,
      lurchTimer: rand(CFG.LURCH_MIN, CFG.LURCH_MAX),
      lurchHold: 0,
      slamming: false,
    });
  }

  for (let i = 0; i < CFG.LANE_COUNT; i++) {
    const lane = lanes[i];
    // ahead — adjacent lanes start beyond the dead zone so nothing spawns
    // alongside the driver as a giant billboard
    const isAdjacent = (i !== 1);
    let s = player.s + (isAdjacent ? CFG.ADJACENT_DEAD_ZONE + CFG.ADJACENT_FADE_ZONE + 2 : 5);
    for (let k = 0; k < CFG.CAR_COUNT_AHEAD; k++) {
      const semiHere = (i === SEMI.lane && k === SEMI.slot);
      const c = spawnCar(i, s + (semiHere ? SEMI.length / 2 : 0), semiHere);
      lane.cars.push(c);
      s = c.s + c.len / 2 + Math.max(CFG.SPACING_TARGET - c.len / 2, CFG.CLEAR_MIN) + rand(0, 1.2);
    }
    // behind
    let sb = player.s - CFG.PLAYER_LENGTH - CFG.SPACING_TARGET * 0.5 - rand(0, 1.5);
    for (let k = 0; k < CFG.CAR_COUNT_BEHIND; k++) {
      const c = spawnCar(i, sb);
      lane.cars.push(c);
      sb -= c.len + Math.max(CFG.SPACING_TARGET - c.len, CFG.CLEAR_MIN) + rand(0, 1.5);
    }
    lane.cars.sort((a, b) => b.s - a.s);
  }
}

function updateWave(lane, dt) {
  lane.waveTimer -= dt;

  if (lane.state === 'crawl') {
    lane.lurchTimer -= dt;
    if (lane.lurchHold > 0) {
      lane.lurchHold -= dt;
      if (lane.lurchHold <= 0) lane.leadTarget = 0;   // ...and stop again
    }
    if (lane.lurchTimer <= 0) {
      // a pointless little forward shuffle
      lane.leadTarget = rand(0.25, 1.0) * CFG.CRAWL_SPEED;
      lane.lurchTimer = rand(CFG.LURCH_MIN, CFG.LURCH_MAX);
      lane.lurchHold  = rand(0.7, 1.8);
    }
    if (lane.waveTimer <= 0) {
      lane.state = 'surge';
      lane.surgeTimer = rand(CFG.SURGE_DURATION_MIN, CFG.SURGE_DURATION_MAX);
      lane.leadTarget = CFG.SURGE_SPEED;
      lane.slamming = false;
    }
  } else if (lane.state === 'surge') {
    lane.surgeTimer -= dt;
    if (lane.surgeTimer <= 0) {
      // ...and then the lead car SLAMS the brakes with zero warning.
      lane.slamming = Math.random() < CFG.SLAM_CHANCE;
      lane.leadTarget = lane.slamming ? 0 : CFG.CRAWL_SPEED * 0.5;
      // the stop propagates back as a chain of horns
      if (lane.slamming && state === 'play') Audio.honkFlurry();
      lane.state = 'crawl';
      lane.waveTimer = rand(CFG.WAVE_INTERVAL_MIN, CFG.WAVE_INTERVAL_MAX);
      lane.lurchTimer = rand(CFG.LURCH_MIN, CFG.LURCH_MAX);
    }
  }
}

// Does the player meaningfully occupy this lane?
function playerInLane(i) {
  return Math.abs(player.x - laneX(i)) < CFG.LANE_WIDTH * 0.60;
}

function updateLane(lane, dt) {
  updateWave(lane, dt);

  const cars = lane.cars;
  // Build the obstacle chain: NPCs plus (when it is in this lane) the player.
  // NPCs never crash into each other and never hit the player — the PLAYER is
  // the only source of collisions (GDD §5).
  const occupies = playerInLane(lane.index);
  const chain = [];
  for (const c of cars) chain.push(c);
  if (occupies) {
    // NPC positions are centres; player.s is the FRONT bumper, so convert.
    chain.push({
      __player: true,
      s: player.s - CFG.PLAYER_LENGTH / 2,
      speed: player.speed,
      len: CFG.PLAYER_LENGTH,
    });
  }
  chain.sort((a, b) => b.s - a.s);

  for (let i = 0; i < chain.length; i++) {
    const car = chain[i];
    if (car.__player) continue;

    let target;
    if (i === 0) {
      target = lane.leadTarget;
    } else {
      const lead = chain[i - 1];
      const gap = (lead.s - lead.len / 2) - (car.s + car.len / 2);   // clear air
      // Spacing is authored nose-to-nose; convert to the clear gap this
      // particular pair needs, so a 16 m semi does not sit 7 m from a hatchback.
      const half = (lead.len + car.len) / 2;
      let wantClear;
      if (lane.index === player.lane0) {
        wantClear = Math.max(CFG.SPACING_TARGET - half, CFG.CLEAR_MIN);
      } else {
        // Adjacent lanes run tighter: mostly ~1.1 player-lengths of clear air —
        // just under what a lane change needs — with the occasional 1.6.
        wantClear = Math.max(car.gapMult * CFG.PLAYER_LENGTH, CFG.CLEAR_MIN);
      }
      // Emote fallout / blinker denial: temporarily even tighter.
      if (car.tailgateUntil > stats.time) wantClear *= EMOTE.TAILGATE_FACTOR;
      if (car.denyUntil     > stats.time) wantClear = Math.min(wantClear, LANE.CLOSE_TARGET_MULT * CFG.PLAYER_LENGTH);

      const minClear = Math.max(CFG.SPACING_MIN - half, CFG.CLEAR_PANIC);
      target = clamp(lead.speed + (gap - wantClear) * CFG.K_GAP, 0, CFG.SURGE_SPEED * 1.05);
      if (gap < minClear && car.denyUntil <= stats.time) target = 0;
      // Actively shutting the door: close faster than gap-following would.
      if (car.denyUntil > stats.time && gap > LANE.CLOSE_TARGET_MULT * CFG.PLAYER_LENGTH) {
        target = Math.max(target, lead.speed + LANE.CLOSE_SPEED_BOOST);
      }
    }

    const dv = target - car.speed;
    let a;
    if (dv > 0) a = Math.min(dv / 0.55, CFG.NPC_ACCEL);
    else        a = Math.max(dv / 0.20, -CFG.NPC_BRAKE_HARSHNESS * car.brakeMult);

    car.accel = a;
    car.speed = Math.max(0, car.speed + a * dt);
    car.s    += car.speed * dt;
    car.braking = (a < -CFG.NPC_BRAKELIGHT_DECEL) || (car.speed < 0.12 && target < 0.12);

    // A car ahead standing on its brakes squeals — louder the closer it is.
    car.screechCooldown = (car.screechCooldown || 0) - dt;
    if (state === 'play' && a < -AUDIO.NPC_SCREECH_DECEL && car.speed > 1.2 && car.screechCooldown <= 0) {
      const ahead = car.s - player.s;
      if (ahead > 0 && ahead < AUDIO.NPC_SCREECH_RANGE) {
        car.screechCooldown = AUDIO.NPC_SCREECH_COOLDOWN;
        const lx = laneX(lane.index);
        Audio.screech({
          pan: clamp((lx - player.x) / (CFG.LANE_WIDTH * 2), -1, 1),
          dist: ahead,
          intensity: clamp(1 - ahead / AUDIO.NPC_SCREECH_RANGE, 0.25, 1),
        });
      }
    }
  }

  // --- recycling -------------------------------------------------------------
  cars.sort((a, b) => b.s - a.s);
  const camS = player.s - CFG.PLAYER_FRONT_OVERHANG;
  for (let k = cars.length - 1; k >= 0; k--) {
    const c = cars[k];
    if (c.s < camS - CFG.RECYCLE_BEHIND && cars.length > 1) {
      const front = cars[0];
      // Join the back of the queue ahead, but never closer than RESPAWN_MIN —
      // a recycled car must never pop into existence near the camera.
      const behindFront = front.s + front.len / 2 + c.len / 2
                        + Math.max(CFG.SPACING_TARGET - (front.len + c.len) / 2, CFG.CLEAR_MIN)
                        + rand(0, 2);
      c.s = Math.max(behindFront, camS + rand(CFG.RESPAWN_MIN, CFG.RESPAWN_MAX));
      c.speed = front.speed;
      cars.splice(k, 1); cars.unshift(c);
    }
  }
  for (let k = 0; k < cars.length; k++) {
    const c = cars[k];
    if (c.s > camS + CFG.RECYCLE_AHEAD && cars.length > 1) {
      const back = cars[cars.length - 1];
      c.s = back.s - back.len / 2 - c.len / 2
           - Math.max(CFG.SPACING_TARGET - (back.len + c.len) / 2, CFG.CLEAR_MIN) - rand(0, 2);
      c.speed = back.speed;
      cars.splice(k, 1); cars.push(c);
      k--;
    }
  }
}

function updateCarVisuals() {
  const camS = player.s - CFG.PLAYER_FRONT_OVERHANG;
  for (const lane of lanes) {
    const lx = laneX(lane.index);
    const adjacent = lane.index !== player.lane0;
    for (const car of lane.cars) {
      const z = camS - car.s;
      let visible = z < 2 && z > -CFG.RECYCLE_AHEAD;

      // Near-field rule: a camera-facing billboard alongside the driver is
      // metres wide and reads as a giant blurry wall. Fade adjacent-lane cars
      // out before they reach the camera and drop them entirely inside the
      // dead zone.
      let fade = 1;
      if (visible && adjacent) {
        const ahead = -z;                       // metres ahead of the camera
        if (ahead < CFG.ADJACENT_DEAD_ZONE) { visible = false; }
        else if (ahead < CFG.ADJACENT_DEAD_ZONE + CFG.ADJACENT_FADE_ZONE) {
          fade = (ahead - CFG.ADJACENT_DEAD_ZONE) / CFG.ADJACENT_FADE_ZONE;
        }
      }
      car.mesh.visible = visible;
      if (!visible) continue;
      if (car.mat.opacity !== fade) car.mat.opacity = fade;

      // Brake lights are a UV offset swap on a shared texture — never a
      // material swap (GDD §6).
      const frame = car.braking ? 1 : 0;

      // Adjacent lanes want the inner flank. Real rear-3/4 art when that atlas
      // is present; otherwise a small yaw on the rear sprite.
      const near = z > -34;
      const wantView = (adjacent && near && car.v34) ? 1 : 0;
      // The left lane shows the opposite flank, so mirror the 3/4 sprite in U.
      const mirror = wantView === 1 && lx < player.x;
      const mirrorKey = mirror ? 1 : 0;

      if (frame !== car.brakeFrame || wantView !== car.viewMode || mirrorKey !== car.mirrorKey) {
        car.brakeFrame = frame;
        car.viewMode = wantView;
        car.mirrorKey = mirrorKey;

        const src = wantView === 1 ? car.v34 : car.variant;
        const tex = wantView === 1 ? car.tex34 : car.texRear;
        const uv  = src.uv[frame];

        if (mirror) {
          tex.repeat.set(-uv.repeat[0], uv.repeat[1]);
          tex.offset.set(uv.offset[0] + uv.repeat[0], uv.offset[1]);
        } else {
          tex.repeat.set(uv.repeat[0], uv.repeat[1]);
          tex.offset.set(uv.offset[0], uv.offset[1]);
        }
        if (car.mat.map !== tex) { car.mat.map = tex; car.mat.needsUpdate = true; }
        // world-space size lives in the geometry, bottom-anchored at the tyres
        car.mesh.geometry = variantGeometry(src);
      }

      // Lane centre, road surface, sim-driven z. Nothing else touches x or y.
      //
      // The billboard is placed at the REAR BUMPER, not the car's centre: the
      // sprite depicts the rear face, and putting that face half a car-length
      // deep made every car look ~2m farther than it physically was — the
      // "collision triggers too early" illusion. (3/4 views depict the whole
      // flank, so those stay at the centre.)
      const zBase = (car.viewMode === 1) ? z : z + car.len / 2;
      car.mesh.position.set(lx, 0, zBase);
      car.mesh.rotation.y = (!car.v34 && adjacent && near && !car.isSemi)
        ? (lx < player.x ? -1 : 1) * CFG.ADJACENT_YAW_DEG * Math.PI / 180
        : 0;
    }
  }
}

// =============================================================================
//  PLAYER
// =============================================================================

const player = {
  s: 0, x: 0, speed: 0, lateral: 0,
  wheel: 0,            // degrees, -MAX..MAX
  gas: 0, brake: 0,    // 0..1 ramped pedal force
  lane0: 1,            // committed lane (stateful — see lane-commit hysteresis)
  accelFelt: 0,
  // JEFF PASS
  signalDir: 0,        // -1 left, 0 off, 1 right
  signalHold: 0,       // s the wheel has been held toward a side
  blinkT: 0,
  scrapeT: 0,          // continuous seconds against a wall
  scraping: false,
};

function resetPlayer() {
  player.s = 0; player.x = 0; player.speed = 0; player.lateral = 0;
  player.wheel = 0; player.gas = 0; player.brake = 0; player.accelFelt = 0;
  player.lane0 = 1;
  player.signalDir = 0; player.signalHold = 0; player.blinkT = 0;
  player.heldSide = 0;
  player.scrapeT = 0; player.scraping = false;
}

function updatePlayer(dt) {
  const inGas   = input.gas   ? 1 : 0;
  const inBrake = input.brake ? 1 : 0;
  player.gas   = approach(player.gas,   inGas,   1 / CFG.PEDAL_RAMP, dt);
  player.brake = approach(player.brake, inBrake, 1 / CFG.PEDAL_RAMP, dt);

  // --- steering wheel --------------------------------------------------------
  let steerInput = 0;
  if (input.left)  steerInput -= 1;
  if (input.right) steerInput += 1;
  if (input.wheelDrag) {
    player.wheel = clamp(input.wheelTarget, -CFG.WHEEL_MAX_DEG, CFG.WHEEL_MAX_DEG);
  } else if (steerInput !== 0) {
    player.wheel = clamp(player.wheel + steerInput * CFG.WHEEL_TURN_RATE * dt,
                         -CFG.WHEEL_MAX_DEG, CFG.WHEEL_MAX_DEG);
  } else {
    player.wheel = approach(player.wheel, 0, CFG.WHEEL_RETURN_RATE, dt);
  }

  // --- longitudinal ----------------------------------------------------------
  const prev = player.speed;
  let a = 0;
  if (player.brake > 0.01) {
    a = -CFG.BRAKE_FORCE * player.brake;
  } else if (player.gas > 0.01) {
    a = CFG.ACCEL * player.gas;
  } else {
    // automatic transmission creep — the authentic gridlock fidget
    if (player.speed < CFG.CREEP_SPEED) a = CFG.ACCEL * 0.30;
    else a = -CFG.COAST_DRAG;
  }
  player.speed = clamp(player.speed + a * dt, 0, CFG.MAX_SPEED);
  player.s += player.speed * dt;
  player.accelFelt = lerp(player.accelFelt, (player.speed - prev) / Math.max(dt, 1e-4), 0.18);

  // --- lateral: heavily speed-limited (GDD §4) ------------------------------
  // At a dead stop the wheel turns but the car just crabs — real lane changes
  // need a surge wave, which is exactly when they are most dangerous.
  const authority = clamp(player.speed / CFG.STEER_SPEED_FALLOFF, 0, 1);
  player.lateral = (player.wheel / CFG.WHEEL_MAX_DEG) * CFG.STEER_RATE * authority;
  player.x += player.lateral * dt;

  // --- turn signal: hold the wheel toward a side for >1s -------------------
  const steerSide = player.wheel > 18 ? 1 : player.wheel < -18 ? -1 : 0;
  if (steerSide === 0) {
    player.signalHold = 0;
    player.signalDir = 0;
  } else if (steerSide === player.heldSide) {
    player.signalHold += dt;
    if (player.signalHold >= LANE.SIGNAL_HOLD_S && player.signalDir !== steerSide) {
      player.signalDir = steerSide;   // blinker auto-starts
      player.blinkT = 0;
    }
  } else {
    player.heldSide = steerSide;
    player.signalHold = 0;
    player.signalDir = 0;
  }
  if (player.signalDir !== 0) {
    const prevBlink = player.blinkT;
    player.blinkT += dt;
    // tick on each phase edge. TODO(audio): real turn-signal relay tick —
    // reusing the distant 'beep' horn voice as the placeholder tone.
    if (Math.floor(prevBlink / (LANE.BLINK_PERIOD_S / 2)) !==
        Math.floor(player.blinkT / (LANE.BLINK_PERIOD_S / 2))) {
      Audio.honk({ kind: 'beep', dist: 85, pan: player.signalDir * 0.4, bus: Audio.sfxBus });
    }
  }

  // --- walls: right sound wall / left guardrail ----------------------------
  const halfW = CFG.PLAYER_SIDE_HALF_WIDTH;
  let touchingWall = false;
  for (const [wallX, side] of [[LANE.WALL_RIGHT_X, 1], [LANE.WALL_LEFT_X, -1]]) {
    const edge = player.x + side * halfW;
    const past = side === 1 ? edge - wallX : wallX - edge;
    if (past < 0) continue;

    const closing = player.lateral * side;   // lateral speed INTO the wall
    if (closing > LANE.WALL_CRASH_MPH * MPH) {
      gameOver(Math.max(closing, CFG.BUMP_TOLERANCE_MPH * MPH * 1.01), null);
      return;
    }
    // survivable scrape: pinned to the wall, speed scrubbing off, rumbling
    touchingWall = true;
    player.x = wallX - side * halfW;
    player.lateral = 0;
    player.speed = Math.max(0, player.speed - LANE.SCRAPE_DRAG * dt);
    shake(LANE.SCRAPE_SHAKE);
    // stamp/grow the streak on the barrier at the contact point
    if (!scrapeDecals.current || scrapeDecals.current.side !== side) beginScrapeDecal(side);
    updateScrapeDecal(dt);
    if (stats.time - stats.lastScrape > 0.45) {
      stats.lastScrape = stats.time;
      // TODO(audio): looping metal-on-concrete scrape — reusing the one-shot
      // scrape placeholder for now.
      Audio.scrape();
    }
  }
  if (touchingWall) {
    player.scrapeT += dt;
    player.scraping = true;
    if (player.scrapeT >= LANE.SCRAPE_MAX_S) {
      gameOver(CFG.BUMP_TOLERANCE_MPH * MPH * 1.5, null);   // ground away the door
      return;
    }
  } else {
    player.scrapeT = 0;
    player.scraping = false;
    scrapeDecals.current = null;   // episode over; the mark stays on the wall
  }

  // --- lane commit: crossed the line by >40% of car width ------------------
  // Wide, explicit hysteresis: you stay in your committed lane until your
  // centreline is COMMIT_FRACTION * width past its boundary line.
  {
    const commit = LANE.COMMIT_FRACTION * CFG.PLAYER_WIDTH;
    const cur = player.lane0;
    const curCentre = laneX(cur);
    const lineR = curCentre + CFG.LANE_WIDTH / 2;
    const lineL = curCentre - CFG.LANE_WIDTH / 2;
    if (cur < CFG.LANE_COUNT - 1 && player.x > lineR + commit) {
      player.lane0 = cur + 1;
      player.signalDir = 0; player.signalHold = 0;   // change made; blinker off
    } else if (cur > 0 && player.x < lineL - commit) {
      player.lane0 = cur - 1;
      player.signalDir = 0; player.signalHold = 0;
    }
  }

  stats.topSpeed = Math.max(stats.topSpeed, player.speed);
}

// =============================================================================
//  COLLISION  (GDD §5)
//  Below BUMP_TOLERANCE_MPH = forgiven love tap, unlimited, escalating honks.
//  Anything above = COMMUTE TERMINATED.
// =============================================================================

function checkCollisions() {
  const tol = CFG.BUMP_TOLERANCE_MPH * MPH;
  // Real footprint: player.s is the front bumper, the body runs back from it,
  // and the box is centred on the car's centreline (player.x), never the eye.
  const pFront = player.s;
  const pRear  = player.s - CFG.PLAYER_LENGTH;
  const pHalfW = CFG.PLAYER_SIDE_HALF_WIDTH;

  for (const lane of lanes) {
    const lx = laneX(lane.index);
    for (const car of lane.cars) {
      const dx = Math.abs(player.x - lx);
      const halfW = pHalfW + car.wid * 0.5 * CFG.NPC_SIDE_SHRINK;
      if (dx > halfW) continue;

      const cFront = car.s + car.len / 2;
      const cRear  = car.s - car.len / 2;
      if (pFront < cRear || pRear > cFront) continue;  // no longitudinal overlap

      const dvLong = player.speed - car.speed;
      const penLong = Math.min(pFront - cRear, cFront - pRear);
      const penLat  = halfW - dx;

      // Severity depends on the KIND of contact. A side-swipe between two cars
      // rolling in the same direction is judged on lateral closing speed —
      // otherwise brushing doors while 2 mph faster than your neighbour would
      // read as a frontal crash.
      const sideContact = penLat < penLong;
      const rel = sideContact
        ? Math.abs(player.lateral) + Math.abs(dvLong) * 0.25
        : Math.hypot(dvLong, player.lateral);

      if (rel > tol) { gameOver(rel, car); return; }

      // ---- love tap ------------------------------------------------------
      if (penLat < penLong) {
        player.x += (player.x < lx ? -1 : 1) * (penLat + 0.01);
        player.lateral = 0;
      } else {
        if (pFront > cRear && player.s > car.s) {
          player.s = cFront + CFG.PLAYER_LENGTH + 0.01;
        } else {
          player.s = cRear - 0.01;
          player.speed = Math.max(0, car.speed * (1 - CFG.BUMP_RESTITUTION));
        }
      }

      if (stats.time - stats.lastBump > 0.6) {
        stats.lastBump = stats.time;
        stats.bumps++;
        Audio.thunk();
        // the car you nudged leans on the horn, angrier every time
        Audio.honk({
          kind: 'lean',
          pan: clamp((lx - player.x) / (CFG.LANE_WIDTH * 1.6), -1, 1),
          dist: 3,
          anger: Math.min(3, stats.bumps),
          bus: Audio.sfxBus,
        });
        stats.honks++;
        shake(0.55);
      }
    }
  }
}

// THE JOKE (JEFF PASS): drivers who can see your blinker close the gap.
// The car behind your target gap accelerates until the space you wanted is
// LANE.CLOSE_TARGET_MULT car-lengths — i.e. gone.
function updateBlinkerDenial() {
  if (player.signalDir === 0) return;
  const target = player.lane0 + player.signalDir;
  if (target < 0 || target >= CFG.LANE_COUNT) return;
  const lane = lanes[target];

  // the gap beside the player: lead = first car ahead, closer = first behind
  let closer = null, bestBehind = Infinity;
  for (const c of lane.cars) {
    const behind = player.s - c.s;
    if (behind > 0 && behind < bestBehind && behind < LANE.CLOSE_SEE_RANGE) {
      bestBehind = behind; closer = c;
    }
  }
  if (closer) {
    if (closer.denyUntil <= stats.time) {
      // just noticed the blinker: commit to shutting the door for 1-2 s
      closer.denyUntil = stats.time + rand(LANE.CLOSE_DURATION_MIN, LANE.CLOSE_DURATION_MAX) + 4;
    } else {
      closer.denyUntil = Math.max(closer.denyUntil, stats.time + 1.5);
    }
  }
}

// Drift toward an occupied lane and the neighbours object — from their own
// pan position, and they get angrier the longer you sit there.
function updateHonking(dt) {
  const encroach = CFG.LANE_WIDTH * CFG.HONK_LATERAL_TRIGGER;
  for (const lane of lanes) {
    if (lane.index === player.lane0) continue;
    const lx = laneX(lane.index);
    const near = Math.abs(player.x - lx) < encroach;
    lane.encroachT = near ? (lane.encroachT || 0) + dt : 0;

    for (const car of lane.cars) {
      car.honkCooldown -= dt;
      if (!near || car.honkCooldown > 0) continue;
      const rel = car.s - player.s;
      if (Math.abs(rel) < CFG.HONK_RANGE) {
        car.honkCooldown = CFG.HONK_COOLDOWN + rand(0, 1.5);
        const anger = clamp(lane.encroachT / 2.5, 0, 2);
        Audio.honk({
          kind: anger > 1.2 ? 'lean' : (anger > 0.5 ? 'mid' : 'double'),
          pan: clamp((lx - player.x) / (CFG.LANE_WIDTH * 1.6), -1, 1),
          dist: Math.max(2, Math.abs(rel)),
          anger,
          bus: Audio.sfxBus,
        });
        stats.honks++;
      }
    }
  }
}

// =============================================================================
//  AUDIO  (GDD §7, §9)
//  Everything is synthesised except the cassette, which is user-supplied.
//  If assets/buttrock.mp3 is missing the stereo plays a placeholder riff.
// =============================================================================

const Audio = {
  ctx: null, ready: false,
  master: null, musicBus: null, ambientBus: null, sfxBus: null,
  engineOsc: [], engineGain: null, rumbleGain: null, rumbleLFO: null,
  musicEl: null, riffTimer: null, usingPlaceholder: false,
  stereoOn: false, noiseBuf: null,
  honkVoices: 0, honkTimer: null, flavorTimer: null,
  _squeakUntil: 0, _crashing: false,

  // ---------------------------------------------------------------- setup --
  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { console.warn('[audio] WebAudio unavailable'); return; }
    this.ctx = new AC();

    // --- bus tree: master -> {music, ambient, sfx} ---
    this.master = this.ctx.createGain();
    this.master.gain.value = AUDIO.MASTER;
    this.master.connect(this.ctx.destination);

    this.musicBus   = this.ctx.createGain();
    this.ambientBus = this.ctx.createGain();
    this.sfxBus     = this.ctx.createGain();
    this.musicBus.gain.value   = 0;             // faded in by the stereo toggle
    this.ambientBus.gain.value = AUDIO.AMBIENT;
    this.sfxBus.gain.value     = AUDIO.SFX;
    for (const b of [this.musicBus, this.ambientBus, this.sfxBus]) b.connect(this.master);

    this.ready = true;
    this._buildNoise();
    this._buildEngine();
    this._buildRumble();
    this._initMusic();
  },

  // iOS will not start a context outside a gesture, and needs a real buffer to
  // play once before it will make any sound at all.
  unlock() {
    if (!this.ready) this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const s = this.ctx.createBufferSource();
    s.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    s.connect(this.ctx.destination);
    s.start(0);
  },

  _buildNoise() {
    const len = this.ctx.sampleRate * 3;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
    this.noiseBuf = buf;
  },

  _buildEngine() {
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 4;
    this.engineGain.connect(lp); lp.connect(this.ambientBus);
    for (const [f, t, g] of [[46, 'sawtooth', 0.5], [92.6, 'sawtooth', 0.28], [138, 'triangle', 0.14]]) {
      const o = this.ctx.createOscillator(); o.type = t; o.frequency.value = f;
      const og = this.ctx.createGain(); og.gain.value = g;
      o.connect(og); og.connect(this.engineGain); o.start();
      this.engineOsc.push({ o, base: f });
    }
  },

  _buildRumble() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    this.rumbleGain = this.ctx.createGain();
    this.rumbleGain.gain.value = 0;
    src.connect(lp); lp.connect(this.rumbleGain); this.rumbleGain.connect(this.ambientBus);
    src.start();

    // slow swells, as if the far lanes were breathing
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1 / AUDIO.RUMBLE_SWELL_S;
    const depth = this.ctx.createGain();
    depth.gain.value = AUDIO.RUMBLE_LEVEL * 0.45;
    lfo.connect(depth); depth.connect(this.rumbleGain.gain);
    lfo.start();
    this.rumbleLFO = lfo;
  },

  _initMusic() {
    // "blown factory speakers": gut the bass, roll off the top, push the mids
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = AUDIO.MUSIC_HIGHPASS_HZ;
    const peak = this.ctx.createBiquadFilter(); peak.type = 'peaking';
    peak.frequency.value = AUDIO.MUSIC_PEAK_HZ; peak.gain.value = AUDIO.MUSIC_PEAK_DB; peak.Q.value = 1.1;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = AUDIO.MUSIC_LOWPASS_HZ; lp.Q.value = 0.9;
    hp.connect(peak); peak.connect(lp); lp.connect(this.musicBus);
    this.musicIn = hp;

    if (ART.musicOk) {
      this.musicEl = new window.Audio(ASSETS.music);
      this.musicEl.loop = true;
      this.musicEl.preload = 'auto';
      this.musicEl.crossOrigin = 'anonymous';
      try {
        this.ctx.createMediaElementSource(this.musicEl).connect(this.musicIn);
        this.usingPlaceholder = false;
        console.info('[audio] cassette loaded from ' + ASSETS.music);
      } catch (e) {
        console.warn('[audio] could not route mp3, falling back to riff', e);
        ART.musicOk = false;
      }
    }
    if (!ART.musicOk) {
      this.usingPlaceholder = true;
      console.info('[audio] no mp3 — stereo will play the placeholder riff');
    }
  },

  // ------------------------------------------------------------- helpers --
  _pan(value) {
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = clamp(value, -1, 1);
      return p;
    }
    // Safari fallbacks: a 3D panner positioned on the X axis
    const p = this.ctx.createPanner();
    p.panningModel = 'equalpower';
    if (p.positionX) p.positionX.value = clamp(value, -1, 1);
    else p.setPosition(clamp(value, -1, 1), 0, 1 - Math.abs(value) * 0.5);
    return p;
  },

  _noise(dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    s.start(); s.stop(this.ctx.currentTime + dur);
    return s;
  },

  // =========================================================== HONK VOICES ==
  // 5 characters. Everything is pitch-jittered, panned, and attenuated +
  // low-passed by distance so the soundscape has depth.
  HONK_KINDS: ['beep', 'double', 'lean', 'sad', 'mid'],

  honk({ kind = 'mid', pan = 0, dist = 12, anger = 0, bus = null } = {}) {
    if (!this.ready) return;
    if (this.honkVoices >= AUDIO.MAX_HONK_VOICES) return;   // voice cap
    this.honkVoices++;

    const t0 = this.ctx.currentTime;
    const jitter = 1 + rand(-AUDIO.HONK_PITCH_JITTER, AUDIO.HONK_PITCH_JITTER);
    const base = ({ beep: 430, double: 470, lean: 355, sad: 300, mid: 400 }[kind]) * jitter;

    // pattern: [offset, duration] blips
    let blips;
    switch (kind) {
      case 'beep':   blips = [[0, 0.16]]; break;
      case 'double': blips = [[0, 0.12], [0.20, 0.13]]; break;
      case 'lean':   blips = [[0, 1.10 + anger * 0.5]]; break;
      case 'sad':    blips = [[0, 0.55]]; break;
      default:       blips = [[0, 0.38]];
    }
    const total = blips[blips.length - 1][0] + blips[blips.length - 1][1];

    // distance: quieter, duller, and slightly wider the further away
    const atten = 1 / (1 + dist / 9);
    const out = this.ctx.createGain();
    out.gain.value = atten * (kind === 'sad' ? 0.55 : 1) * (1 + anger * 0.25);

    const tone = this.ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = clamp(9000 / (1 + dist / 6), 700, 9000) * (kind === 'sad' ? 0.45 : 1);

    const shape = this.ctx.createBiquadFilter();
    shape.type = 'bandpass';
    shape.frequency.value = base * 2.1;
    shape.Q.value = 1.1 + anger * 0.5;

    const panner = this._pan(pan);
    shape.connect(tone); tone.connect(out); out.connect(panner);
    panner.connect(bus || this.ambientBus);

    for (const [off, dur] of blips) {
      const t = t0 + off;
      const g = this.ctx.createGain();
      const peak = 0.20 + anger * 0.05;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.025);
      g.gain.setValueAtTime(peak, t + Math.max(0.03, dur - 0.07));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      // a real horn is two slightly detuned reeds plus a harmonic
      for (const m of [1, 1.5, 2.02]) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = base * m;
        // angry horns waver
        if (anger > 0) o.frequency.setValueAtTime(base * m * (1 + 0.01 * anger), t + dur * 0.5);
        o.connect(g); o.start(t); o.stop(t + dur + 0.03);
      }
      g.connect(shape);
    }

    setTimeout(() => { this.honkVoices = Math.max(0, this.honkVoices - 1); }, (total + 0.2) * 1000);
  },

  randomHonk() {
    const kind = this.HONK_KINDS[randi(this.HONK_KINDS.length)];
    this.honk({
      kind,
      pan: rand(-1, 1),
      dist: rand(AUDIO.HONK_MIN_DIST, AUDIO.HONK_MAX_DIST),
    });
  },

  // A wave slamming to a halt sets off a chain of horns down the queue.
  honkFlurry(n) {
    if (!this.ready) return;
    const count = n || Math.round(rand(AUDIO.FLURRY_MIN, AUDIO.FLURRY_MAX));
    for (let i = 0; i < count; i++) {
      const delay = (i / count) * AUDIO.FLURRY_SPREAD_S + rand(0, 0.25);
      setTimeout(() => this.randomHonk(), delay * 1000);
    }
  },

  // rateMult is a GAMEPLAY dial (the emote doubles ambient honk frequency for
  // a while) — same voices, same levels, just scheduled more often.
  rateMult: 1,

  _scheduleHonks() {
    const next = rand(AUDIO.HONK_MIN_S, AUDIO.HONK_MAX_S) / (this.rateMult || 1);
    this.honkTimer = setTimeout(() => {
      if (!this._crashing) this.randomHonk();
      this._scheduleHonks();
    }, next * 1000);
  },

  // ------------------------------------ distant, off-screen flavour events --
  // Purely atmospheric: no visible NPC ever collides (GDD §5).
  _scheduleFlavor() {
    const next = rand(AUDIO.FLAVOR_MIN_S, AUDIO.FLAVOR_MAX_S);
    this.flavorTimer = setTimeout(() => {
      if (!this._crashing) {
        if (Math.random() < AUDIO.FLAVOR_CRASH_CHANCE) this.distantCrash();
        else this.screech({ pan: rand(-1, 1), dist: rand(45, 90), intensity: 0.7 });
      }
      this._scheduleFlavor();
    }, next * 1000);
  },

  startAmbient() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(AUDIO.ENGINE_LEVEL, t, 0.6);
    this.rumbleGain.gain.setTargetAtTime(AUDIO.RUMBLE_LEVEL, t, 0.8);
    this.ambientBus.gain.setTargetAtTime(AUDIO.AMBIENT, t, 0.4);
    if (this.honkTimer) clearTimeout(this.honkTimer);
    if (this.flavorTimer) clearTimeout(this.flavorTimer);
    this._crashing = false;
    this._scheduleHonks();
    this._scheduleFlavor();
  },

  // ================================================================ MUSIC ==
  toggleStereo() {
    if (!this.ready) this.init();
    if (!this.ready) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.stereoOn = !this.stereoOn;
    const t = this.ctx.currentTime;
    if (this.stereoOn) {
      this.musicBus.gain.cancelScheduledValues(t);
      this.musicBus.gain.setTargetAtTime(AUDIO.MUSIC, t, 0.10);
      if (this.musicEl) {
        // resume where it left off — the cassette is stuck in there
        this.musicEl.play().catch(err => console.warn('[audio] play blocked', err));
      } else {
        this._startRiff();
      }
    } else {
      this.musicBus.gain.cancelScheduledValues(t);
      this.musicBus.gain.setTargetAtTime(0, t, 0.08);
      // pause, never rewind
      if (this.musicEl) setTimeout(() => { if (!this.stereoOn) this.musicEl.pause(); }, 160);
      if (this.riffTimer) { clearTimeout(this.riffTimer); this.riffTimer = null; }
    }
    return this.stereoOn;
  },

  _riffNote(time, freq, dur, gainVal) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gainVal, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    const shaper = this.ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 4.5); }
    shaper.curve = curve;
    for (const mult of [1, 1.4983, 2]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = freq * mult;
      o.connect(shaper); o.start(time); o.stop(time + dur + 0.05);
    }
    shaper.connect(g); g.connect(this.musicIn);
  },

  _startRiff() {
    const E2 = 82.41, G2 = 98.00, A2 = 110.00, D2 = 73.42;
    const pattern = [E2, E2, G2, E2, A2, A2, G2, D2];
    let step = 0, next = this.ctx.currentTime + 0.05;
    const beat = 0.30;
    const tick = () => {
      if (!this.stereoOn) return;
      while (next < this.ctx.currentTime + 0.35) {
        const f = pattern[step % pattern.length];
        this._riffNote(next, f, beat * 0.92, 0.16);
        if (step % 2 === 0) this._riffNote(next + beat * 0.5, f * 2, beat * 0.3, 0.07);
        next += beat; step++;
      }
      this.riffTimer = setTimeout(tick, 120);
    };
    tick();
  },

  // ========================================================= REACTIVE SFX ==
  setEngine(speed, gas) {
    if (!this.ready) return;
    const rpm = 0.55 + speed / CFG.MAX_SPEED * 1.5 + gas * 0.35;
    const t = this.ctx.currentTime;
    for (const e of this.engineOsc) e.o.frequency.setTargetAtTime(e.base * rpm, t, 0.12);
    if (!this._crashing) {
      this.engineGain.gain.setTargetAtTime(AUDIO.ENGINE_LEVEL + gas * AUDIO.ENGINE_GAS_BOOST, t, 0.15);
    }
  },

  // tyre squeal — used for the player's own brakes and for NPCs ahead
  screech({ pan = 0, dist = 0, intensity = 1 } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const atten = 1 / (1 + dist / 10);
    const dur = 0.30 + intensity * 0.22;
    const n = this._noise(dur + 0.05);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 18 + intensity * 8;
    bp.frequency.setValueAtTime(1900 + rand(-200, 200), t);
    bp.frequency.linearRampToValueAtTime(3300 + rand(-300, 300), t + dur);
    const g = this.ctx.createGain();
    const peak = 0.13 * intensity * atten;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = this._pan(pan);
    n.connect(bp); bp.connect(g); g.connect(p); p.connect(this.sfxBus);
  },

  squeak() {
    if (!this.ready || this._squeakUntil > this.ctx.currentTime) return;
    this._squeakUntil = this.ctx.currentTime + 0.85;
    this.screech({ pan: -0.15, dist: 0, intensity: 1 });
  },

  thunk() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.13);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
    o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + 0.22);

    const n = this._noise(0.09);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.35, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    n.connect(lp); lp.connect(ng); ng.connect(this.sfxBus);
  },

  scrape() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const n = this._noise(0.3);
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 1600; bp.Q.value = 6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    n.connect(bp); bp.connect(g); g.connect(this.sfxBus);
  },

  glassTinkle(t0, atten = 1) {
    for (let i = 0; i < 14; i++) {
      const t = t0 + rand(0.02, 0.7);
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = rand(2400, 6200);
      const g = this.ctx.createGain();
      const pk = rand(0.015, 0.05) * atten;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(pk, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.10, 0.30));
      const p = this._pan(rand(-0.6, 0.6));
      o.connect(g); g.connect(p); p.connect(this.sfxBus);
      o.start(t); o.stop(t + 0.35);
    }
  },

  // big layered crunch: noise burst + low thump + torn metal + glass
  crash() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;

    const n = this._noise(0.8);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.9, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    n.connect(lp); lp.connect(ng); ng.connect(this.sfxBus);

    const thump = this.ctx.createOscillator(); thump.type = 'sine';
    thump.frequency.setValueAtTime(120, t);
    thump.frequency.exponentialRampToValueAtTime(32, t + 0.35);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.85, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    thump.connect(tg); tg.connect(this.sfxBus); thump.start(t); thump.stop(t + 0.55);

    for (const f of [780, 1130, 1490, 2210]) {
      const o = this.ctx.createOscillator();
      o.type = 'square'; o.frequency.value = f * rand(0.96, 1.05);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.085, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.9, 1.5));
      o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + 1.6);
    }
    this.glassTinkle(t + 0.06, 1);
  },

  // far-off pileup: muffled, then everyone out there leans on the horn
  distantCrash() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const pan = rand(-0.9, 0.9);
    const n = this._noise(0.7);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 620;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    const p = this._pan(pan);
    n.connect(lp); lp.connect(g); g.connect(p); p.connect(this.ambientBus);

    const thump = this.ctx.createOscillator(); thump.type = 'sine';
    thump.frequency.setValueAtTime(90, t);
    thump.frequency.exponentialRampToValueAtTime(38, t + 0.4);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.18, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    const p2 = this._pan(pan);
    thump.connect(tg); tg.connect(p2); p2.connect(this.ambientBus);
    thump.start(t); thump.stop(t + 0.6);

    setTimeout(() => this.honkFlurry(Math.round(rand(3, 5))), 500);
  },

  // ---------------------------------------------------- game-over sequence --
  // crash -> silence -> one lone sad horn a long way off -> stats
  crashSequence() {
    if (!this.ready) return;
    this._crashing = true;
    const t = this.ctx.currentTime;

    // cut the buttrock instantly
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setValueAtTime(0, t);
    this.stereoOn = false;
    if (this.riffTimer) { clearTimeout(this.riffTimer); this.riffTimer = null; }
    if (this.musicEl) this.musicEl.pause();

    // duck the world under the impact, then let it fall away to silence
    this.ambientBus.gain.cancelScheduledValues(t);
    this.ambientBus.gain.setTargetAtTime(AUDIO.AMBIENT * AUDIO.CRASH_DUCK, t, 0.12);
    this.engineGain.gain.setTargetAtTime(0, t, 0.35);
    this.rumbleGain.gain.setTargetAtTime(0, t, 0.5);
    this.ambientBus.gain.setTargetAtTime(0, t + 0.9, 0.35);

    this.crash();

    // one lone, distant, defeated horn
    setTimeout(() => {
      if (!this.ready) return;
      const tt = this.ctx.currentTime;
      this.ambientBus.gain.setValueAtTime(AUDIO.AMBIENT, tt);
      this.honkVoices = 0;
      this.honk({ kind: 'sad', pan: rand(-0.5, 0.5), dist: 55, bus: this.ambientBus });
    }, AUDIO.GAMEOVER_SAD_HONK_S * 1000);
  },

  stopAmbient() {
    if (this.honkTimer) { clearTimeout(this.honkTimer); this.honkTimer = null; }
    if (this.flavorTimer) { clearTimeout(this.flavorTimer); this.flavorTimer = null; }
  },

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); },
  resume()  { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
};

// =============================================================================
//  COCKPIT + HUD OVERLAY (2D canvas)
//  Static cockpit is rendered once per resize into an offscreen canvas and
//  blitted; only the live bits (wheel, pedals, needles, digits, mirror) redraw.
// =============================================================================

const ui = {
  canvas: null, ctx: null, dpr: 1, w: 0, h: 0,
  cockpit: null,       // offscreen static layer
  rect: null,          // where the cockpit art landed { x, y, w, h }
  hit: {},             // hit-test rectangles in CSS px
};

function cockpitPlaceholder(w, h) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const G = COCKPIT.glass;
  const gx = G.x * w, gy = G.y * h, gw = G.w * w, gh = G.h * h;

  // interior shell
  const shell = ctx.createLinearGradient(0, 0, 0, h);
  shell.addColorStop(0,   '#5d5952');
  shell.addColorStop(0.5, '#46433d');
  shell.addColorStop(1,   '#2e2c28');
  ctx.fillStyle = shell;
  ctx.fillRect(0, 0, w, h);

  // punch the windshield out
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(gx + gw * 0.055, gy);
  ctx.lineTo(gx + gw * 0.945, gy);
  ctx.lineTo(gx + gw,         gy + gh);
  ctx.lineTo(gx,              gy + gh);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // dash slab
  const dashTop = gy + gh;
  const dash = ctx.createLinearGradient(0, dashTop, 0, h);
  dash.addColorStop(0, '#54504a'); dash.addColorStop(0.35, '#3b3833'); dash.addColorStop(1, '#26241f');
  ctx.fillStyle = dash;
  roundRect(ctx, -20, dashTop - h * 0.02, w + 40, h, h * 0.05);
  ctx.fill();

  // instrument binnacle
  const bx = 0.155 * w, by = dashTop + h * 0.035, bw = 0.34 * w, bh = h * 0.20;
  ctx.fillStyle = '#1b1a17';
  roundRect(ctx, bx, by, bw, bh, h * 0.02); ctx.fill();
  ctx.strokeStyle = '#5b574f'; ctx.lineWidth = 2; ctx.stroke();
  // two dials
  ctx.strokeStyle = '#7d786e'; ctx.lineWidth = 2;
  for (const fx of [0.30, 0.66]) {
    ctx.beginPath();
    ctx.arc(bx + bw * fx, by + bh * 0.46, bh * 0.34, 0, Math.PI * 2);
    ctx.stroke();
  }

  // head unit
  const S = COCKPIT.stereo;
  ctx.fillStyle = '#211f1c';
  roundRect(ctx, S.x * w, S.y * h, S.w * w, S.h * h, h * 0.008); ctx.fill();
  ctx.strokeStyle = '#4c4842'; ctx.lineWidth = 2; ctx.stroke();
  // cassette slot
  const K = COCKPIT.cassette;
  ctx.fillStyle = '#0d0c0b';
  roundRect(ctx, K.x * w, K.y * h, K.w * w, K.h * h, h * 0.004); ctx.fill();
  // little knobs
  ctx.fillStyle = '#3a3630';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(S.x * w + S.w * w * (0.14 + i * 0.10), S.y * h + S.h * h * 0.82, h * 0.010, 0, Math.PI * 2);
    ctx.fill();
  }

  // rearview mirror housing
  const M = COCKPIT.mirror;
  ctx.fillStyle = '#1d1c1a';
  roundRect(ctx, (M.x - 0.012) * w, (M.y - 0.016) * h, (M.w + 0.024) * w, (M.h + 0.032) * h, h * 0.014);
  ctx.fill();
  ctx.fillStyle = '#2b2f33';
  roundRect(ctx, M.x * w, M.y * h, M.w * w, M.h * h, h * 0.008); ctx.fill();
  // stalk
  ctx.fillStyle = '#1d1c1a';
  ctx.fillRect((M.x + M.w * 0.46) * w, 0, w * 0.016, M.y * h);

  // A-pillars
  ctx.fillStyle = '#4a4740';
  ctx.beginPath();
  ctx.moveTo(gx, gy); ctx.lineTo(gx + gw * 0.055, gy);
  ctx.lineTo(gx, gy + gh); ctx.lineTo(gx - gw * 0.06, gy + gh);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(gx + gw, gy); ctx.lineTo(gx + gw * 0.945, gy);
  ctx.lineTo(gx + gw, gy + gh); ctx.lineTo(gx + gw * 1.06, gy + gh);
  ctx.closePath(); ctx.fill();

  return c;
}

function layoutUI() {
  // The overlay canvas is the 16:9 view rect exactly, positioned over the GL
  // canvas. Everything below is therefore rect-relative by construction and
  // cannot drift against the dashboard art on resize or rotate.
  const v = computeView();
  view.x = v.x; view.y = v.y; view.w = v.w; view.h = v.h;
  const w = v.w, h = v.h;
  const dpr = Math.min(window.devicePixelRatio || 1, CFG.MAX_PIXEL_RATIO);
  ui.w = w; ui.h = h; ui.dpr = dpr;

  ui.canvas.width  = Math.max(1, Math.round(w * dpr));
  ui.canvas.height = Math.max(1, Math.round(h * dpr));
  ui.canvas.style.left = v.x + 'px';
  ui.canvas.style.top = v.y + 'px';
  ui.canvas.style.width = w + 'px';
  ui.canvas.style.height = h + 'px';
  ui.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // The cockpit art is 16:9, so it fills the rect with no letterboxing of its
  // own and every COCKPIT fraction maps straight onto the view.
  const artW = w;
  const artH = artW / COCKPIT.ASPECT;
  ui.rect = { x: 0, y: h - artH, w: artW, h: artH };

  const off = makeCanvas(Math.max(1, Math.round(artW * dpr)), Math.max(1, Math.round(artH * dpr)));
  const octx = off.getContext('2d');
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ART.cockpit) {
    octx.drawImage(ART.cockpit, 0, 0, artW, artH);
  } else {
    const ph = cockpitPlaceholder(Math.max(1, Math.round(artW)), Math.max(1, Math.round(artH)));
    if (ph.width > 0 && ph.height > 0) octx.drawImage(ph, 0, 0, artW, artH);
  }
  ui.cockpit = off;

  // --- hit targets ---------------------------------------------------------
  const R = ui.rect;
  const S = COCKPIT.stereo;
  const sx = R.x + S.x * R.w, sy = R.y + S.y * R.h;
  const sw = S.w * R.w,       sh = S.h * R.h;
  ui.stereoArt = { x: sx, y: sy, w: sw, h: sh };
  // the tap target is the art rect, grown to a comfortable minimum
  const tw = Math.max(sw, TOUCH.MIN_TARGET_PX), th = Math.max(sh, TOUCH.MIN_TARGET_PX);
  ui.hit.stereo = { x: sx + sw / 2 - tw / 2, y: sy + sh / 2 - th / 2, w: tw, h: th };

  // --- pedals: each keeps its own sprite aspect ---------------------------
  const short = Math.min(w, h);
  const ph = Math.max(short * TOUCH.PEDAL_H, TOUCH.MIN_TARGET_PX);
  const m  = short * TOUCH.PEDAL_MARGIN;
  const gap = short * TOUCH.PEDAL_GAP;
  const aspect = i => {
    const c = ART.pedalCells && ART.pedalCells[i];
    return c && c.glow ? c.glow.w / c.glow.h : 0.62;
  };
  const gasW   = Math.max(ph * aspect(0), TOUCH.MIN_TARGET_PX);
  const brakeW = Math.max(ph * aspect(2), TOUCH.MIN_TARGET_PX);
  ui.hit.gas   = { x: w - m - gasW, y: h - m - ph, w: gasW, h: ph };
  ui.hit.brake = { x: w - m - gasW - gap - brakeW, y: h - m - ph, w: brakeW, h: ph };

  // emote button: left side, above the wheel (view-rect fractions, min 64px)
  {
    const b = EMOTE.btn;
    const bw = Math.max(b.w * w, TOUCH.MIN_TARGET_PX);
    const bh = Math.max(b.h * h, TOUCH.MIN_TARGET_PX);
    ui.hit.emote = { x: b.x * w, y: b.y * h, w: bw, h: bh };
  }

  const wr = Math.max(short * TOUCH.WHEEL_R, TOUCH.MIN_TARGET_PX);
  ui.hit.wheel = { cx: R.x + COCKPIT.wheel.cx * R.w, cy: R.y + COCKPIT.wheel.cy * R.h, r: wr };
  ui.hit.wheel.cx = clamp(ui.hit.wheel.cx, wr * 0.8, w * 0.5);
  ui.hit.wheel.cy = Math.min(ui.hit.wheel.cy, h - wr * 0.35);
  // the art layer covers the wheel baked into the dashboard
  ui.wheelArtR = Math.max(COCKPIT.wheel.r * R.w, wr * 0.7);
}

// Procedural wheel, used only when SteeringWheel.png is absent.
function drawWheelPlaceholder(ctx, r) {
  ctx.lineWidth = r * 0.20; ctx.strokeStyle = '#26241f';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.90, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = r * 0.13; ctx.strokeStyle = '#3c382f';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.90, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#332f29';
  for (const a of [Math.PI, 0, Math.PI * 0.5]) {
    ctx.save(); ctx.rotate(a);
    roundRect(ctx, 0, -r * 0.075, r * 0.92, r * 0.15, r * 0.05); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#282520';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3e3a33';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2); ctx.fill();
}

function drawWheel(ctx, cx, cy, r, deg) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(deg * Math.PI / 180);
  if (ART.wheel && ART.wheelPivot) {
    // rotate about the rim centre, not the canvas centre
    const p = ART.wheelPivot;
    const size = r * 2;
    const scale = size / p.size;
    ctx.drawImage(ART.wheel, -p.cx * scale, -p.cy * scale,
                  ART.wheel.naturalWidth * scale, ART.wheel.naturalHeight * scale);
  } else {
    drawWheelPlaceholder(ctx, r);
  }
  ctx.restore();
}

function drawPedal(ctx, rect, cellIndex, label, pressed) {
  const cells = ART.pedalCells;
  if (ART.pedals && cells && cells[cellIndex] && cells[cellIndex].glow) {
    const b = cells[pressed ? cellIndex + 1 : cellIndex].glow;
    ctx.drawImage(ART.pedals, b.x0, b.y0, b.w, b.h, rect.x, rect.y, rect.w, rect.h);
  } else {
    const grad = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    if (pressed) { grad.addColorStop(0, 'rgba(240,205,120,0.92)'); grad.addColorStop(1, 'rgba(190,150,60,0.92)'); }
    else         { grad.addColorStop(0, 'rgba(38,36,32,0.72)');    grad.addColorStop(1, 'rgba(20,19,17,0.78)'); }
    ctx.fillStyle = grad;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(rect.w, rect.h) * 0.20);
    ctx.fill();
    ctx.strokeStyle = pressed ? 'rgba(255,235,180,0.95)' : 'rgba(220,215,200,0.42)';
    ctx.lineWidth = 2; ctx.stroke();
  }
  // the art carries no lettering, so label it (GDD §8)
  ctx.save();
  ctx.fillStyle = pressed ? 'rgba(255,226,160,0.95)' : 'rgba(226,222,210,0.66)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${clamp(rect.w * 0.20, 9, 15)}px ui-monospace, Menlo, monospace`;
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h + clamp(rect.w * 0.22, 11, 17));
  ctx.restore();
}

// Rearview mirror sizing: the car behind is rendered as if it sat between
// these distances, so it stays small in the glass.
const MIRROR_NEAR_M = 8, MIRROR_FAR_M = 15, MIRROR_MAX_H = 0.46;

function drawMirror(ctx) {
  const R = ui.rect, M = COCKPIT.mirror;
  const x = R.x + M.x * R.w, y = R.y + M.y * R.h;
  const w = M.w * R.w, h = M.h * R.h;
  if (w < 12 || h < 8) return;

  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, h * 0.10);
  ctx.clip();

  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#9fb9cd'); g.addColorStop(0.42, '#c3ccd1'); g.addColorStop(0.44, '#5c5f62');
  g.addColorStop(1, '#4a4d50');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);

  const lane = lanes[player.lane0];
  let best = null, bestGap = Infinity;
  if (lane) {
    for (const c of lane.cars) {
      const gap = player.s - CFG.PLAYER_LENGTH - c.s;
      if (gap > 0 && gap < bestGap) { bestGap = gap; best = c; }
    }
  }
  if (best && ART.frontsCanvas && bestGap < 45) {
    const idx = FRONTS.ORDER.indexOf(best.isSemi ? 'semi' : best.variant.type);
    const cell = ART.frontsCells[idx >= 0 ? idx : 0];
    if (cell && cell.glow) {
      const b = cell.glow;
      const aspect = b.w / b.h;
      // Drawn as if the car behind were 8-15 m back, creeping between those
      // bounds — small in the glass, never looming.
      const shown = clamp(bestGap, MIRROR_NEAR_M, MIRROR_FAR_M);
      const k = MIRROR_NEAR_M / shown;            // 1.0 at 8 m -> 0.53 at 15 m
      let dh = h * MIRROR_MAX_H * k;
      let dw = dh * aspect;
      if (dw > w * 0.78) { dw = w * 0.78; dh = dw / aspect; }
      const dx = x + w * 0.5 - dw / 2;
      const dy = y + h * 0.76 - dh;
      ctx.globalAlpha = clamp(1.2 - bestGap / 60, 0.30, 1);
      ctx.drawImage(ART.frontsCanvas, b.x0, b.y0, b.w, b.h, dx, dy, dw, dh);
      ctx.globalAlpha = 1;
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(x, y, w, h * 0.4);
  ctx.restore();
}

function fmtClock(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// The dash gauges are static art, so the live numbers get their own slab over
// the binnacle: trip metre in FEET, time in traffic, speed, love taps.
function drawHUD(ctx) {
  const R = ui.rect, T = COCKPIT.trip;
  const x = R.x + T.x * R.w, y = R.y + T.y * R.h;
  const w = T.w * R.w,       h = T.h * R.h;
  if (h < 16) return;

  ctx.save();
  ctx.fillStyle = 'rgba(9,10,9,0.80)';
  roundRect(ctx, x, y, w, h, h * 0.12); ctx.fill();
  ctx.strokeStyle = 'rgba(150,160,150,0.20)'; ctx.lineWidth = 1; ctx.stroke();

  const feet = Math.max(0, (player.s - stats.startS) * FT);
  const pad = w * 0.045;
  const rowH = h / 2;
  const fs = clamp(rowH * 0.52, 7, 17);
  ctx.font = `700 ${fs}px ui-monospace, Menlo, monospace`;
  ctx.textBaseline = 'middle';

  // row 1: trip metre (the joke stat) | clock
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8d8a8';
  ctx.fillText(`${feet.toFixed(0).padStart(5, '0')} ft`, x + pad, y + rowH * 0.52);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8fd0b0';
  ctx.fillText(fmtClock(stats.time), x + w - pad, y + rowH * 0.52);

  // row 2: speed | love taps
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(226,222,210,0.72)';
  ctx.fillText(`${(player.speed / MPH).toFixed(1)} mph`, x + pad, y + rowH * 1.48);
  if (stats.bumps > 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e2a45c';
    ctx.fillText(`BUMPS ${stats.bumps}`, x + w - pad, y + rowH * 1.48);
  }
  ctx.restore();
}

function drawStereo(ctx) {
  const A = ui.stereoArt;
  const on = Audio.stereoOn;
  if (!A) return;

  if (ART.stereo && ART.stereoCells && ART.stereoCells.length >= 2) {
    const cell = ART.stereoCells[on ? 1 : 0];
    if (cell && cell.glow) {
      const b = cell.glow;
      ctx.drawImage(ART.stereo, b.x0, b.y0, b.w, b.h, A.x, A.y, A.w, A.h);
    }
  } else {
    // placeholder state: LED + 2-frame cassette spindles
    ctx.save();
    ctx.fillStyle = on ? '#5cff8c' : '#1e2a20';
    ctx.beginPath();
    ctx.arc(A.x + A.w * 0.06, A.y + A.h * 0.16, Math.max(2, A.h * 0.06), 0, Math.PI * 2);
    ctx.fill();
    const spin = on ? (Math.floor(stats.time * 6) % 2) : 0;
    for (const fx of [0.42, 0.62]) {
      const cx = A.x + A.w * fx, cy = A.y + A.h * 0.52, r = A.h * 0.11;
      ctx.fillStyle = on ? '#d9d2bd' : '#8b8676';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2b2822'; ctx.lineWidth = Math.max(1, r * 0.22);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + spin * 0.52;
        ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // unambiguous state caption, and it names the placeholder riff
  ctx.save();
  const fs = clamp(ui.rect.h * 0.018, 7, 12);
  ctx.font = `700 ${fs}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = on ? 'rgba(120,255,160,0.85)' : 'rgba(200,195,180,0.40)';
  ctx.fillText(on ? (Audio.usingPlaceholder ? '▶ SIDE A' : '▶ PLAY') : '■ STOP',
               A.x + A.w * 0.5, A.y + A.h + fs * 0.3);
  ctx.restore();
}

// =============================================================================
//  DEBUG OVERLAY (toggle: G). Default off. Draws lane centres, every NPC's
//  world box with its z distance and lane index, and the adjacent-lane spawn
//  dead zones. Screenshot-friendly.
// =============================================================================

let debugOn = false;
const _v = new THREE.Vector3();

function project(x, y, z) {
  _v.set(x, y, z).project(camera);
  return { x: (_v.x * 0.5 + 0.5) * ui.w, y: (-_v.y * 0.5 + 0.5) * ui.h, behind: _v.z > 1 };
}

function drawDebug(ctx) {
  const camS = player.s - CFG.PLAYER_FRONT_OVERHANG;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = '11px ui-monospace, Menlo, monospace';
  ctx.textBaseline = 'bottom';

  // --- lane centre lines ---
  for (let i = 0; i < CFG.LANE_COUNT; i++) {
    const lx = laneX(i);
    ctx.strokeStyle = i === player.lane0 ? 'rgba(120,255,160,0.85)' : 'rgba(120,190,255,0.55)';
    ctx.beginPath();
    let started = false;
    for (let d = 2; d <= 120; d += 2) {
      const p = project(lx, 0.02, -d);
      if (p.behind) continue;
      started ? ctx.lineTo(p.x, p.y) : (ctx.moveTo(p.x, p.y), started = true);
    }
    ctx.stroke();
  }

  // --- adjacent-lane dead zone + fade band ---
  for (const i of [0, 1, 2]) {
    if (i === player.lane0) continue;
    const lx = laneX(i);
    for (const [d, col] of [[CFG.ADJACENT_DEAD_ZONE, 'rgba(255,80,80,0.9)'],
                            [CFG.ADJACENT_DEAD_ZONE + CFG.ADJACENT_FADE_ZONE, 'rgba(255,190,70,0.75)']]) {
      const a = project(lx - CFG.LANE_WIDTH * 0.45, 0.02, -d);
      const b = project(lx + CFG.LANE_WIDTH * 0.45, 0.02, -d);
      if (a.behind || b.behind) continue;
      ctx.strokeStyle = col;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    const lbl = project(lx, 0.02, -CFG.ADJACENT_DEAD_ZONE);
    if (!lbl.behind) {
      ctx.fillStyle = 'rgba(255,80,80,0.95)';
      ctx.fillText('dead zone', lbl.x - 26, lbl.y - 2);
    }
  }

  // --- NPC boxes ---
  for (const lane of lanes) {
    const lx = laneX(lane.index);
    for (const car of lane.cars) {
      if (!car.mesh.visible) continue;
      const z = camS - car.s;
      const v = car.viewMode === 1 && car.v34 ? car.v34 : car.variant;
      const hw = v.planeW / 2, ht = v.planeH - v.footOffset;
      const c = [project(lx - hw, 0, z), project(lx + hw, 0, z),
                 project(lx + hw, ht, z), project(lx - hw, ht, z)];
      if (c.some(p => p.behind)) continue;
      ctx.strokeStyle = car.braking ? 'rgba(255,90,70,0.95)' : 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.moveTo(c[0].x, c[0].y);
      for (let k = 1; k < 4; k++) ctx.lineTo(c[k].x, c[k].y);
      ctx.closePath(); ctx.stroke();

      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      const label = `L${lane.index} ${car.isSemi ? 'semi' : car.variant.type} ${(-z).toFixed(1)}m`;
      const tw = ctx.measureText(label).width + 6;
      ctx.fillRect(c[3].x, c[3].y - 14, tw, 14);
      ctx.fillStyle = '#e8e4d8';
      ctx.fillText(label, c[3].x + 3, c[3].y - 2);
    }
  }

  // --- the player's own collision box: front bumper line + side walls ---
  // This is the calibration aid for PLAYER_FRONT_OVERHANG and the side width.
  {
    const hw = CFG.PLAYER_SIDE_HALF_WIDTH;
    const zFront = -CFG.PLAYER_FRONT_OVERHANG;               // bumper, in camera space
    const zRear  = zFront + CFG.PLAYER_LENGTH;
    const fl = project(player.x - hw, 0.03, zFront);
    const fr = project(player.x + hw, 0.03, zFront);
    if (!fl.behind && !fr.behind) {
      ctx.strokeStyle = 'rgba(90,255,140,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(fl.x, fl.y); ctx.lineTo(fr.x, fr.y); ctx.stroke();
      ctx.fillStyle = 'rgba(90,255,140,0.95)';
      ctx.fillText(`front bumper  ${CFG.PLAYER_FRONT_OVERHANG.toFixed(2)}m`, fl.x, fl.y - 4);
      ctx.lineWidth = 1;
    }
    // side walls, drawn back along the body
    ctx.strokeStyle = 'rgba(90,255,140,0.45)';
    for (const sx of [-hw, hw]) {
      const a = project(player.x + sx, 0.03, zFront);
      const b = project(player.x + sx, 0.03, Math.min(zRear, -0.15));
      if (a.behind || b.behind) continue;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // gap to the nearest car ahead in the player's lane
    const ln = lanes[player.lane0];
    if (ln) {
      let g = Infinity;
      for (const c of ln.cars) {
        const d = (c.s - c.len / 2) - player.s;
        if (d >= 0 && d < g) g = d;
      }
      if (g < Infinity) {
        ctx.fillStyle = g < 0.5 ? '#ff6a46' : '#e8e4d8';
        ctx.fillText(`gap ${g.toFixed(2)}m`, fl.x, fl.y + 14);
      }
    }
  }

  // --- legend ---
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(8, 8, 268, 92);
  ctx.fillStyle = '#e8e4d8';
  ctx.fillText('DEBUG (G)  lanes / NPC boxes / bumper', 14, 24);
  ctx.fillText(`lane w ${CFG.LANE_WIDTH}m   spacing ${CFG.SPACING_TARGET}m n2n`, 14, 40);
  ctx.fillText(`player lane ${player.lane0}  x ${player.x.toFixed(2)}m`, 14, 56);
  ctx.fillText(`overhang ${CFG.PLAYER_FRONT_OVERHANG}m  halfW ${CFG.PLAYER_SIDE_HALF_WIDTH}m`, 14, 72);
  ctx.fillText(`view ${view.w}x${view.h}  seat ${CFG.CAMERA_SEAT_OFFSET_X}m`, 14, 88);
  ctx.restore();
}

// ---------------------------------------------------------------- JEFF PASS --

// GPS unit: absent from the dash until the mile-one unlock, then drops in.
function drawGPS(ctx) {
  if (!gps.active) return;
  const R = ui.rect, G = GPS.rect;
  const w = G.w * R.w, h = G.h * R.h;
  const x = R.x + G.x * R.w;
  const drop = 1 - (gps.dropT / GPS.DROP_S);
  const y = R.y + G.y * R.h - drop * drop * h * 1.4;   // ease-out drop-in

  ctx.save();

  if (ART.gpsCanvas && ART.gpsOn) {
    // real art: ON cell, magenta screen replaced by our live map
    const cell = ART.gpsOn;
    ctx.drawImage(ART.gpsCanvas, cell.x0, cell.y0, cell.w, cell.h, x, y, w, h);
    var sx = x + ART.gpsScreen.x * w, sy = y + ART.gpsScreen.y * h;
    var sw = ART.gpsScreen.w * w,     sh = ART.gpsScreen.h * h;
  } else {
    // placeholder unit: slab + bracket
    ctx.fillStyle = '#22211f';
    roundRect(ctx, x, y, w, h, h * 0.10); ctx.fill();
    ctx.strokeStyle = '#4c4842'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#1a1918';
    ctx.fillRect(x + w * 0.42, y + h, w * 0.16, h * 0.16);
    sx = x + w * 0.06; sy = y + h * 0.08; sw = w * 0.88; sh = h * 0.80;
  }

  // --- the screen ----------------------------------------------------------
  ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
  ctx.fillStyle = '#101d16';
  ctx.fillRect(sx, sy, sw, sh);

  // fake top-down map: grid, route, chevron (you), checkered pin (destination)
  ctx.strokeStyle = 'rgba(90,140,110,0.35)'; ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const gy2 = sy + (sh / 4) * i;
    ctx.beginPath(); ctx.moveTo(sx, gy2); ctx.lineTo(sx + sw, gy2); ctx.stroke();
  }
  for (let i = 1; i < 5; i++) {
    const gx2 = sx + (sw / 5) * i;
    ctx.beginPath(); ctx.moveTo(gx2, sy); ctx.lineTo(gx2, sy + sh); ctx.stroke();
  }
  // route: a straight line you are barely moving along
  ctx.strokeStyle = '#7fd6a2'; ctx.lineWidth = Math.max(2, sh * 0.05);
  ctx.beginPath();
  ctx.moveTo(sx + sw * 0.18, sy + sh * 0.86);
  ctx.lineTo(sx + sw * 0.82, sy + sh * 0.16);
  ctx.stroke();
  // chevron = you
  ctx.save();
  ctx.translate(sx + sw * 0.24, sy + sh * 0.79);
  ctx.rotate(-0.72);
  ctx.fillStyle = '#eef4ee';
  ctx.beginPath();
  ctx.moveTo(0, -sh * 0.07); ctx.lineTo(sh * 0.05, sh * 0.06);
  ctx.lineTo(0, sh * 0.02);  ctx.lineTo(-sh * 0.05, sh * 0.06);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // checkered destination pin
  {
    const px2 = sx + sw * 0.82, py2 = sy + sh * 0.16, s = Math.max(3, sh * 0.055);
    for (let cy = 0; cy < 2; cy++) for (let cx = 0; cx < 2; cx++) {
      ctx.fillStyle = (cx + cy) % 2 ? '#101010' : '#e8e8e2';
      ctx.fillRect(px2 + cx * s, py2 - s * 2 + cy * s, s, s);
    }
    ctx.strokeStyle = '#c9c9c2'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px2, py2); ctx.lineTo(px2, py2 - s * 2); ctx.stroke();
  }

  // readouts: DEST + a huge, ever-growing ETA
  const mono = 'ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#bfe8cd';
  ctx.font = `600 ${Math.max(7, sh * 0.14)}px ${mono}`;
  ctx.fillText(`DEST: ${gps.destMi.toFixed(1)} mi`, sx + sw * 0.05, sy + sh * 0.05);

  if (gps.recalcFlash > 0 && Math.floor(gps.recalcFlash * 6) % 2 === 0) {
    ctx.fillStyle = '#ffd27a';
    ctx.font = `700 ${Math.max(7, sh * 0.15)}px ${mono}`;
    ctx.fillText('RECALCULATING...', sx + sw * 0.05, sy + sh * 0.40);
  } else {
    const hrs = Math.floor(gps.etaMin / 60), mins = Math.round(gps.etaMin % 60);
    const eta = hrs > 0 ? `${hrs}h ${String(mins).padStart(2, '0')}m` : `${mins} min`;
    ctx.fillStyle = '#eef4ee';
    ctx.font = `700 ${Math.max(10, sh * 0.26)}px ${mono}`;
    ctx.fillText(`ETA ${eta}`, sx + sw * 0.05, sy + sh * 0.36);
  }
  ctx.restore();
}

function drawUnlockBanner(ctx) {
  if (!unlocks.banner) return;
  const t = unlocks.banner.t;
  // slide in (0-0.4s), hold, slide out (last 0.6s)
  const inK  = clamp(t / 0.4, 0, 1);
  const outK = clamp((t - 4.0) / 0.6, 0, 1);
  const k = Math.min(1 - Math.pow(1 - inK, 3), 1) * (1 - outK * outK);
  const bh = clamp(ui.h * 0.085, 34, 64);
  const y = -bh + k * (bh + ui.h * 0.03);

  ctx.save();
  ctx.fillStyle = 'rgba(12,14,12,0.92)';
  const bw = Math.min(ui.w * 0.6, 520);
  const x = (ui.w - bw) / 2;
  roundRect(ctx, x, y, bw, bh, 6); ctx.fill();
  ctx.strokeStyle = '#ffc14d'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#ffc14d';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${bh * 0.34}px ui-monospace, Menlo, monospace`;
  ctx.fillText(unlocks.banner.text, ui.w / 2, y + bh / 2);
  ctx.restore();
}

// blinker indicator on the dash, left or right of the instrument cluster
function drawBlinker(ctx) {
  if (player.signalDir === 0) return;
  const on = Math.floor(player.blinkT / (LANE.BLINK_PERIOD_S / 2)) % 2 === 0;
  if (!on) return;
  const R = ui.rect, T = COCKPIT.trip;
  const size = clamp(R.h * 0.028, 8, 20);
  const y = R.y + (T.y + 0.012) * R.h;
  const x = R.x + (player.signalDir < 0 ? (T.x - 0.030) : (T.x + T.w + 0.030)) * R.w;
  ctx.save();
  ctx.fillStyle = '#63d97c';
  ctx.shadowColor = 'rgba(99,217,124,0.9)'; ctx.shadowBlur = size * 0.8;
  ctx.beginPath();
  const d = player.signalDir;
  ctx.moveTo(x + d * size, y + size * 0.55);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + size * 1.1);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// First-person thumbs-up: rise / hold / present-away, from the bottom edge.
function drawEmote(ctx) {
  // the touch button (always available during play)
  if (state === 'play' && ui.hit.emote) {
    const r = ui.hit.emote;
    const ready = stats.time >= emote.cooldownUntil;
    ctx.save();
    ctx.globalAlpha = ready ? 0.85 : 0.35;
    ctx.fillStyle = 'rgba(30,32,30,0.75)';
    roundRect(ctx, r.x, r.y, r.w, r.h, Math.min(r.w, r.h) * 0.2); ctx.fill();
    ctx.strokeStyle = ready ? 'rgba(232,228,216,0.55)' : 'rgba(232,228,216,0.25)';
    ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    // simple stroked thumb glyph (no emoji)
    ctx.save();
    ctx.globalAlpha = ready ? 0.9 : 0.4;
    ctx.strokeStyle = '#e8e4d8'; ctx.lineWidth = Math.max(2, r.h * 0.06);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, s = Math.min(r.w, r.h) * 0.30;
    ctx.beginPath();
    ctx.moveTo(cx - s, cy + s * 0.2); ctx.lineTo(cx - s * 0.3, cy + s * 0.2);
    ctx.lineTo(cx - s * 0.3, cy + s);
    ctx.moveTo(cx - s * 0.3, cy + s * 0.2);
    ctx.lineTo(cx + s * 0.1, cy - s * 0.7);
    ctx.lineTo(cx + s * 0.5, cy - s * 0.5);
    ctx.lineTo(cx + s * 0.2, cy + s * 0.2);
    ctx.lineTo(cx + s * 0.8, cy + s * 0.2);
    ctx.lineTo(cx + s * 0.8, cy + s);
    ctx.stroke();
    ctx.restore();
  }

  if (emote.t < 0) return;
  const t = emote.t;
  // phase -> vertical progress (0 = fully off-screen, 1 = presented)
  // cell 1 on the slide-up, cell 2 for the hold, cell 3 as a brief flourish
  // while still fully presented, kept through the slide-away.
  const FLOURISH = Math.min(0.35, EMOTE.HOLD_S * 0.3);
  let k, frame;
  if (t < EMOTE.RISE_S)                                  { k = t / EMOTE.RISE_S; frame = 0; }
  else if (t < EMOTE.RISE_S + EMOTE.HOLD_S - FLOURISH)   { k = 1; frame = 1; }
  else if (t < EMOTE.RISE_S + EMOTE.HOLD_S)              { k = 1; frame = 2; }
  else { k = 1 - (t - EMOTE.RISE_S - EMOTE.HOLD_S) / EMOTE.AWAY_S; frame = 2; }
  k = clamp(k, 0, 1);
  const ease = 1 - Math.pow(1 - k, 2);

  const hh = ui.h * 0.62;                       // hand height on screen
  const y = ui.h - ease * hh;
  const xC = ui.w * 0.60;                       // right of the wheel, driver's arm

  ctx.save();
  if (ART.handCanvas && ART.handCells && ART.handCells[frame] && ART.handCells[frame].glow) {
    // The three frames have very different crop heights (the fist-only rise
    // frame is ~60% the height of the hold frame) but share a common bottom
    // edge in the sheet. One shared scale, anchored at the sprite bottom —
    // scaling each frame to the same screen height would make the arm jump
    // size between frames.
    if (!ART.handScaleH) {
      ART.handScaleH = Math.max(...ART.handCells.map(c => c.glow ? c.glow.h : 1));
    }
    const b = ART.handCells[frame].glow;
    const scale = hh / ART.handScaleH;
    const dw = b.w * scale, dh = b.h * scale;
    const bottom = ui.h + (1 - ease) * hh;   // rises from fully off-screen
    ctx.drawImage(ART.handCanvas, b.x0, b.y0, b.w, b.h, xC - dw / 2, bottom - dh, dw, dh);
  } else {
    // placeholder drawn hand — the real 3-frame sprite drops into ASSETS.hand
    const s = hh * 0.5;
    ctx.translate(xC, y + hh * 0.55);
    ctx.fillStyle = '#caa287';
    roundRect(ctx, -s * 0.28, -s * 0.1, s * 0.56, s * 0.9, s * 0.1); ctx.fill();   // fist
    roundRect(ctx, -s * 0.16, -s * 0.62, s * 0.24, s * 0.6, s * 0.12); ctx.fill(); // thumb
    ctx.fillStyle = '#6a6f78';
    roundRect(ctx, -s * 0.5, s * 0.55, s, s * 0.9, s * 0.1); ctx.fill();           // sleeve
  }
  ctx.restore();
}

function drawOverlay() {
  const ctx = ui.ctx;
  ctx.clearRect(0, 0, ui.w, ui.h);

  // The dashboard's mirror glass is transparent, so paint the reflection first
  // and let the housing frame it.
  drawMirror(ctx);

  if (ui.rect.y > 0) {
    ctx.fillStyle = COCKPIT.HEADLINER;
    ctx.fillRect(0, 0, ui.w, ui.rect.y + 1);
  }
  ctx.drawImage(ui.cockpit, ui.rect.x, ui.rect.y, ui.rect.w, ui.rect.h);

  drawHUD(ctx);
  drawStereo(ctx);
  drawGPS(ctx);
  drawBlinker(ctx);

  const W = ui.hit.wheel;
  drawWheel(ctx, W.cx, W.cy, ui.wheelArtR || W.r, player.wheel);
  drawPedal(ctx, ui.hit.brake, 2, 'BRAKE', input.brake);
  drawPedal(ctx, ui.hit.gas,   0, 'GAS',   input.gas);

  drawEmote(ctx);
  drawUnlockBanner(ctx);

  if (debugOn) drawDebug(ctx);
}

// =============================================================================
//  INPUT
// =============================================================================

const input = {
  gas: false, brake: false, left: false, right: false,
  wheelDrag: false, wheelTarget: 0,
  pointers: new Map(),
};

function pointInRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

// Pointer coords are window-space; every hit rect is view-rect-space. The
// overlay canvas IS the view rect, so subtract its origin.
function localX(e) { return e.clientX - view.x; }
function localY(e) { return e.clientY - view.y; }

function bindInput() {
  addEventListener('keydown', e => {
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    input.gas = true; e.preventDefault(); break;
      case 'Space': case 'ArrowDown': input.brake = true; e.preventDefault(); break;
      case 'KeyA': case 'ArrowLeft':  input.left = true; e.preventDefault(); break;
      case 'KeyD': case 'ArrowRight': input.right = true; e.preventDefault(); break;
      case 'KeyS': if (state === 'play') Audio.toggleStereo(); break;
      case 'KeyG': debugOn = !debugOn; break;
      case 'KeyE': triggerEmote(); break;
    }
  });
  addEventListener('keyup', e => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    input.gas = false; break;
      case 'Space': case 'ArrowDown': input.brake = false; break;
      case 'KeyA': case 'ArrowLeft':  input.left = false; break;
      case 'KeyD': case 'ArrowRight': input.right = false; break;
    }
  });

  const cv = ui.canvas;
  cv.style.pointerEvents = 'auto';

  cv.addEventListener('pointerdown', e => {
    if (state !== 'play') return;
    // Can throw for a pointer that is already gone (fast tap, or synthetic
    // events); capture is a nicety, not a requirement.
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    const x = localX(e), y = localY(e);

    if (pointInRect(x, y, ui.hit.gas))        { input.pointers.set(e.pointerId, 'gas');   input.gas = true; return; }
    if (pointInRect(x, y, ui.hit.brake))      { input.pointers.set(e.pointerId, 'brake'); input.brake = true; return; }
    if (pointInRect(x, y, ui.hit.stereo))     { input.pointers.set(e.pointerId, 'stereo'); Audio.toggleStereo(); return; }
    if (ui.hit.emote && pointInRect(x, y, ui.hit.emote)) { input.pointers.set(e.pointerId, 'emote'); triggerEmote(); return; }

    const W = ui.hit.wheel;
    if (Math.hypot(x - W.cx, y - W.cy) <= W.r * 1.25) {
      input.pointers.set(e.pointerId, 'wheel');
      input.wheelDrag = true;
      input.wheelGrabAngle = Math.atan2(y - W.cy, x - W.cx) * 180 / Math.PI;
      input.wheelGrabValue = player.wheel;
      input.wheelTarget = player.wheel;
    }
  });

  cv.addEventListener('pointermove', e => {
    const role = input.pointers.get(e.pointerId);
    if (role !== 'wheel') return;
    const W = ui.hit.wheel;
    const a = Math.atan2(localY(e) - W.cy, localX(e) - W.cx) * 180 / Math.PI;
    let d = a - input.wheelGrabAngle;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    input.wheelTarget = clamp(input.wheelGrabValue + d, -CFG.WHEEL_MAX_DEG, CFG.WHEEL_MAX_DEG);
  });

  const release = e => {
    const role = input.pointers.get(e.pointerId);
    if (role === 'gas')   input.gas = false;
    if (role === 'brake') input.brake = false;
    if (role === 'wheel') input.wheelDrag = false;
    input.pointers.delete(e.pointerId);
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  cv.addEventListener('contextmenu', e => e.preventDefault());

  addEventListener('resize', () => { layoutUI(); resizeRenderer(); });
  addEventListener('orientationchange', () => setTimeout(() => { layoutUI(); resizeRenderer(); }, 120));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      input.gas = input.brake = input.left = input.right = false;
      Audio.suspend();
    } else if (state === 'play') {
      Audio.resume();
    }
  });

  // The rotate blocker (pwa.js) freezes the sim and the soundscape while it is
  // up, so a phone turned to portrait does not keep playing behind it.
  addEventListener('ts3:pause', () => {
    paused = true;
    input.gas = input.brake = input.left = input.right = false;
    Audio.suspend();
  });
  addEventListener('ts3:resume', () => {
    paused = false;
    last = performance.now();     // do not bank the wall-clock time spent paused
    if (state === 'play') Audio.resume();
  });

  // Belt and braces for the autoplay policy: the very first gesture anywhere
  // unlocks the context, whichever surface it lands on.
  const firstGesture = () => {
    Audio.unlock();
    removeEventListener('pointerdown', firstGesture);
    removeEventListener('touchend', firstGesture);
    removeEventListener('keydown', firstGesture);
  };
  addEventListener('pointerdown', firstGesture, { passive: true });
  addEventListener('touchend',    firstGesture, { passive: true });
  addEventListener('keydown',     firstGesture);
}

// =============================================================================
//  GAME STATE
// =============================================================================

let state = 'start';   // start | play | over
let paused = false;    // held up by the rotate blocker (see pwa.js)
const stats = {
  time: 0, startS: 0, bumps: 0, honks: 0, topSpeed: 0,
  lastBump: -9, lastScrape: -9, impact: 0,
};

let shakeAmt = 0, shakeT = 0;
function shake(a) { shakeAmt = Math.max(shakeAmt, a); }

function startGame() {
  document.getElementById('start').hidden = true;
  const over = document.getElementById('over');
  over.classList.remove('show');    // reset the fade for the next crash
  over.hidden = true;
  resetPlayer();
  resetUnlocks();
  fadeOutScrapeDecals();          // last run's wall damage fades away
  emote.t = -1; emote.cooldownUntil = 0;
  Audio.rateMult = 1;
  stats.time = 0; stats.startS = player.s; stats.bumps = 0; stats.honks = 0;
  stats.topSpeed = 0; stats.lastBump = -9; stats.lastScrape = -9; stats.impact = 0;
  shakeAmt = 0;
  camera.rotation.set(0, 0, 0);

  for (const lane of lanes) for (const car of lane.cars) disposeCar(car);
  buildTraffic();

  // This runs from a click/tap, which is the only place iOS will let a context
  // start. unlock() resumes and plays a 1-sample buffer to satisfy Safari.
  Audio.unlock();
  Audio.startAmbient();
  state = 'play';
}

function gameOver(relSpeed, car) {
  if (state !== 'play') return;
  state = 'over';
  stats.impact = relSpeed;
  input.gas = input.brake = false;
  // crash -> the world falls silent -> one lone distant horn -> the form
  Audio.stopAmbient();
  Audio.crashSequence();
  shake(1.6);

  const feet = Math.max(0, (player.s - stats.startS) * FT);
  const avg  = stats.time > 0 ? (feet / FT) / stats.time / MPH : 0;

  // The stats are the joke. Format them plainly and get out of the way.
  document.getElementById('sTime').textContent = fmtClock(stats.time);
  document.getElementById('sDist').textContent = `${feet.toFixed(0)} ft`;
  document.getElementById('sTop').textContent  = `${Math.round(stats.topSpeed / MPH)} mph`;
  document.getElementById('sAvg').textContent  = `${avg.toFixed(1)} mph`;

  // one render per crash, ready long before anyone taps share
  buildShareCard(stats.time, feet, stats.topSpeed / MPH, avg);

  // Hold on the freeze-frame, then fade in so the lone distant horn lands as
  // the screen arrives.
  const over = document.getElementById('over');
  setTimeout(() => {
    over.hidden = false;
    void over.offsetWidth;          // force a reflow so the transition runs.
    over.classList.add('show');     // (rAF would be throttled in a hidden tab)
  }, AUDIO.GAMEOVER_FADE_START_S * 1000);
}

// =============================================================================
//  JEFF PASS — wall-scrape decals
//  StreakCrash.png stamped along the barrier at the contact point. The streak
//  spans from where the scrape began to the car's current position, so it
//  grows with duration; episodes persist for the run and fade out on restart.
// =============================================================================

const scrapeDecals = { list: [], dying: [], current: null };

function streakTexture() {
  if (ART.streakTex) return ART.streakTex;
  if (!ART.streakCanvas) return null;
  const b = ART.streakBox;
  const c = makeCanvas(b.w, b.h);
  c.getContext('2d').drawImage(ART.streakCanvas, b.x0, b.y0, b.w, b.h, 0, 0, b.w, b.h);
  ART.streakTex = textureFrom(c);
  return ART.streakTex;
}

function beginScrapeDecal(side) {
  const tex = streakTexture();
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    side: THREE.DoubleSide,
    // slightly darker on the LEFT guardrail so paint-transfer reads on metal
    color: side < 0 ? LANE.DECAL_TINT_LEFT : 0xffffff,
  });
  if (tex) mat.map = tex;
  else     mat.color.setHex(side < 0 ? 0x565a5e : 0x8f8a80);   // fallback: bare smear

  const mesh = new THREE.Mesh(UNIT_DECAL, mat);
  mesh.rotation.y = Math.PI / 2;
  // stamped on the VISUAL barrier face, nudged off it to avoid z-fighting
  mesh.position.x = side > 0 ? WORLD.WALL_X - 0.05 : WORLD.RAIL_X + 0.05;
  mesh.position.y = LANE.DECAL_Y_M;
  mesh.renderOrder = 2;
  scene.add(mesh);

  const d = { mesh, side, s0: player.s, s1: player.s, mat };
  scrapeDecals.current = d;
  scrapeDecals.list.push(d);
  while (scrapeDecals.list.length > LANE.DECAL_MAX) {
    const old = scrapeDecals.list.shift();
    scene.remove(old.mesh); old.mat.dispose();
  }
}

function updateScrapeDecal(dt) {
  const d = scrapeDecals.current;
  if (!d) return;
  d.s1 = player.s;
  // grinding in place still chews the barrier a little
  d.s0 -= LANE.DECAL_GROW_S * dt * 0.5;
}

function layoutScrapeDecals(camS) {
  for (const d of scrapeDecals.list) {
    const len = Math.max(Math.abs(d.s1 - d.s0), LANE.DECAL_MIN_LEN);
    d.mesh.scale.set(len, LANE.DECAL_HEIGHT_M, 1);
    d.mesh.position.z = camS - (d.s0 + d.s1) / 2;
  }
  // the previous run's marks fade out; this run's marks are untouched
  for (let i = scrapeDecals.dying.length - 1; i >= 0; i--) {
    const d = scrapeDecals.dying[i];
    d.mesh.position.z = camS - (d.s0 + d.s1) / 2;
    d.mat.opacity -= 0.04;
    if (d.mat.opacity <= 0) {
      scene.remove(d.mesh); d.mat.dispose();
      scrapeDecals.dying.splice(i, 1);
    }
  }
}

function fadeOutScrapeDecals() {
  scrapeDecals.current = null;
  scrapeDecals.dying.push(...scrapeDecals.list);
  scrapeDecals.list.length = 0;
}

// =============================================================================
//  JEFF PASS — distance unlocks + GPS
// =============================================================================

const unlocks = { fired: {}, banner: null };

const gps = {
  active: false, dropT: 0,
  destMi: 0, etaMin: 0,
  nextRecalc: 0, recalcFlash: 0,
};

function resetUnlocks() {
  unlocks.fired = {};
  unlocks.banner = null;
  gps.active = false;
  gps.dropT = 0;
  gps.destMi = GPS.DEST_MI_START;
  gps.etaMin = GPS.ETA_START_MIN;
  gps.nextRecalc = 0;
  gps.recalcFlash = 0;
}

function fireUnlock(u) {
  unlocks.fired[u.id] = true;
  unlocks.banner = { text: `UNLOCKED: ${u.label}`, t: 0 };
  // TODO(audio): real unlock chime — reusing the short 'beep' horn voice,
  // twice, as the placeholder tone.
  Audio.honk({ kind: 'beep', dist: 30, pan: 0, bus: Audio.sfxBus });
  setTimeout(() => Audio.honk({ kind: 'beep', dist: 20, pan: 0, bus: Audio.sfxBus }), 180);

  if (u.id === 'gps') {
    gps.active = true;
    gps.dropT = 0;
    gps.nextRecalc = stats.time + rand(GPS.RECALC_MIN_S, GPS.RECALC_MAX_S);
  }
}

function updateUnlocks(dt) {
  const feet = Math.max(0, (player.s - stats.startS) * FT);
  for (const u of UNLOCKS) {
    if (!unlocks.fired[u.id] && feet >= u.ft) fireUnlock(u);
  }
  if (unlocks.banner) {
    unlocks.banner.t += dt;
    if (unlocks.banner.t > 4.6) unlocks.banner = null;
  }

  if (gps.active) {
    gps.dropT = Math.min(gps.dropT + dt, GPS.DROP_S);
    // Distance ticks down insultingly slowly and never reaches zero.
    gps.destMi = Math.max(GPS.DEST_MI_FLOOR,
      GPS.DEST_MI_START - (feet / 5280) * GPS.DEST_PROGRESS_RATIO);
    // The ETA ONLY EVER GOES UP.
    if (gps.recalcFlash > 0) gps.recalcFlash -= dt;
    if (stats.time >= gps.nextRecalc) {
      gps.nextRecalc = stats.time + rand(GPS.RECALC_MIN_S, GPS.RECALC_MAX_S);
      gps.etaMin += Math.round(rand(GPS.ETA_BUMP_MIN, GPS.ETA_BUMP_MAX));
      gps.recalcFlash = GPS.RECALC_FLASH_S;
      // TODO(audio): GPS "recalculating" chirp — reusing the 'beep' horn
      // voice as the placeholder tone.
      Audio.honk({ kind: 'beep', dist: 40, pan: 0.3, bus: Audio.sfxBus });
    }
  }
}

// =============================================================================
//  JEFF PASS — thumbs-up emote
// =============================================================================

const emote = { t: -1, cooldownUntil: 0 };
const EMOTE_TOTAL = () => EMOTE.RISE_S + EMOTE.HOLD_S + EMOTE.AWAY_S;

function triggerEmote() {
  if (state !== 'play' || paused) return;
  if (stats.time < emote.cooldownUntil) return;
  emote.t = 0;
  emote.cooldownUntil = stats.time + EMOTE.COOLDOWN_S;

  // ENRAGE nearby traffic: everyone within RAGE_RADIUS honks in an
  // overlapping flurry, louder and denser than the ambient bed. Existing honk
  // voices only — the boost rides the anger parameter.
  const nearby = [];
  for (const lane of lanes) {
    const lx = laneX(lane.index);
    for (const c of lane.cars) {
      const d = Math.hypot(c.s - player.s, lx - player.x);
      if (d < EMOTE.RAGE_RADIUS) nearby.push({ c, d, lx });
    }
  }
  nearby.sort((a, b) => a.d - b.d);
  nearby.forEach(({ c, d, lx }, i) => {
    setTimeout(() => {
      Audio.honk({
        kind: i % 3 === 0 ? 'lean' : (i % 3 === 1 ? 'double' : 'mid'),
        pan: clamp((lx - player.x) / (CFG.LANE_WIDTH * 1.6), -1, 1),
        dist: Math.max(2, d * 0.5),          // denser + closer = louder
        anger: 2 * (EMOTE.RAGE_VOLUME_BOOST - 0.5),   // = +50% peak volume
        bus: Audio.sfxBus,
      });
      stats.honks++;
    }, i * 140 + Math.random() * 120);
  });

  // The two nearest cars take it personally: 30% tighter following with
  // harsher brake slams, for a while.
  for (const { c } of nearby.slice(0, EMOTE.TAILGATE_COUNT)) {
    c.tailgateUntil = stats.time + EMOTE.TAILGATE_S;
    c.brakeMult = EMOTE.TAILGATE_BRAKE_MULT;
    setTimeout(() => { c.brakeMult = 1; }, EMOTE.TAILGATE_S * 1000);
  }

  // Ambient honk frequency doubles for a while (same voices, just more often).
  Audio.rateMult = EMOTE.AMBIENT_RATE_MULT;
  clearTimeout(emote.rateTimer);
  emote.rateTimer = setTimeout(() => { Audio.rateMult = 1; }, EMOTE.AMBIENT_RATE_S * 1000);
}

function updateEmote(dt) {
  if (emote.t >= 0) {
    emote.t += dt;
    if (emote.t > EMOTE_TOTAL()) emote.t = -1;
  }
}

// =============================================================================
//  SHARE CARD
//  1200x630 PNG built once per crash, handed to the native share sheet with a
//  matching text line. Desktop browsers cannot share files, so they download.
// =============================================================================

const share = { blob: null, objectURL: null, text: '', superlative: '' };

function superlativeFor(seconds, feet) {
  if (feet < SHARE.NOWHERE_FT) return SHARE.NOWHERE_TEXT;
  for (const s of SHARE.SUPERLATIVES) if (seconds < s.under) return s.text;
  return SHARE.SUPERLATIVES[SHARE.SUPERLATIVES.length - 1].text;
}

function shareURL() {
  const h = location.hostname;
  if (!h || h === 'localhost' || h === '127.0.0.1' || location.protocol === 'file:') {
    return SHARE.URL;
  }
  return (location.host + location.pathname).replace(/index\.html$/, '').replace(/\/$/, '');
}

// Shrink until it fits: the superlative must never overflow the card.
function fitFont(ctx, text, maxW, startPx, weight, family) {
  let px = startPx;
  for (; px > 12; px -= 1) {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  return px;
}

function drawShareCard(secs, feet, topMph, avgMph) {
  const W = SHARE.W, H = SHARE.H;
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const SANS = 'ui-sans-serif, -apple-system, Helvetica, Arial, sans-serif';

  ctx.fillStyle = SHARE.BG;
  ctx.fillRect(0, 0, W, H);

  // --- brake-light glow along the bottom edge ---
  const glow = ctx.createLinearGradient(0, H - 110, 0, H);
  glow.addColorStop(0, 'rgba(255,40,20,0)');
  glow.addColorStop(1, 'rgba(255,42,20,0.22)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, H - 110, W, 110);
  for (let i = 0; i < 7; i++) {
    const gx = (i + 0.5) * (W / 7);
    const g = ctx.createRadialGradient(gx, H, 0, gx, H, 130);
    g.addColorStop(0, 'rgba(255,60,32,0.20)');
    g.addColorStop(1, 'rgba(255,60,32,0)');
    ctx.fillStyle = g;
    ctx.fillRect(gx - 130, H - 130, 260, 130);
  }

  let y = 44;

  // --- title ---
  if (ART.title) {
    const tw = 420, th = tw * (ART.title.naturalHeight / ART.title.naturalWidth);
    ctx.drawImage(ART.title, (W - tw) / 2, y, tw, th);
    y += th + 26;
  } else {
    ctx.fillStyle = '#f2ede0';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const px = fitFont(ctx, 'TRAFFIC SIMULATOR 3000', W - 160, 58, 700, SANS);
    ctx.fillText('TRAFFIC SIMULATOR 3000', W / 2, y);
    y += px + 30;
  }

  // --- superlative ---
  const sup = share.superlative;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const supPx = fitFont(ctx, sup, W - 130, 62, 700, SANS);
  ctx.fillStyle = '#ffc14d';
  ctx.fillText(sup, W / 2, y);
  y += supPx + 44;

  // --- stats block ---
  const rows = [
    ['Time in traffic:', fmtClock(secs)],
    ['Distance:',        `${feet.toFixed(0)} ft`],
    ['Top speed:',       `${Math.round(topMph)} mph`],
    ['Average speed:',   `${avgMph.toFixed(1)} mph`],
  ];
  const boxW = 620, x0 = (W - boxW) / 2, rowH = 40;
  ctx.font = `500 27px ${MONO}`;
  ctx.textBaseline = 'middle';
  for (let i = 0; i < rows.length; i++) {
    const ry = y + i * rowH + rowH / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9aa1a8';
    ctx.fillText(rows[i][0], x0, ry);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e8e4d8';
    ctx.font = `700 27px ${MONO}`;
    ctx.fillText(rows[i][1], x0 + boxW, ry);
    ctx.font = `500 27px ${MONO}`;
  }
  y += rows.length * rowH;

  // --- url ---
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `500 22px ${MONO}`;
  ctx.fillStyle = 'rgba(154,161,168,0.85)';
  ctx.fillText(shareURL(), W / 2, H - 42);

  return c;
}

// Built once per crash, never per tap.
function buildShareCard(secs, feet, topMph, avgMph) {
  share.superlative = superlativeFor(secs, feet);
  share.text = `${share.superlative} — ${feet.toFixed(0)} ft in ${fmtClock(secs)}.`;

  const canvas = drawShareCard(secs, feet, topMph, avgMph);

  if (share.objectURL) { URL.revokeObjectURL(share.objectURL); share.objectURL = null; }
  share.blob = null;

  // hide the previous run's thumbnail so a stale card never flashes
  const thumb = document.getElementById('shareThumb');
  if (thumb) { thumb.hidden = true; thumb.removeAttribute('src'); }

  canvas.toBlob(blob => {
    if (!blob) { console.warn('[share] toBlob failed'); return; }
    share.blob = blob;
    share.objectURL = URL.createObjectURL(blob);
    if (thumb) { thumb.src = share.objectURL; thumb.hidden = false; }
  }, 'image/png');
}

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.hidden = true; }, 400);
  }, 2200);
}

async function doShare() {
  if (!share.blob) { toast('Still rendering'); return; }
  const file = new File([share.blob], 'traffic-simulator-3000.png', { type: 'image/png' });
  const payload = {
    files: [file],
    title: 'Traffic Simulator 3000',
    text: share.text,
  };

  if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
    try {
      await navigator.share(payload);
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;   // user dismissed the sheet
      console.info('[share] share() failed, downloading instead:', err && err.message);
    }
  }

  // Fallback: save the PNG. No clipboard gymnastics.
  const a = document.createElement('a');
  a.href = share.objectURL;
  a.download = 'traffic-simulator-3000.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('Image saved');
}

// =============================================================================
//  RENDER LOOP
// =============================================================================

/**
 * The largest 16:9 rect that fits the window, centred. Everything -- the 3D
 * render, the cockpit art, the HUD, the pedals, the wheel and every touch
 * target -- lives inside this rect, so their relationship never changes with
 * window shape. Outside it is black: letterbox or pillarbox.
 *
 * The dashboard art happens to be 1672x941 (1.7768), which is 16:9 to within a
 * tenth of a percent, so the cockpit fills the rect exactly.
 */
function computeView() {
  const W = Math.max(1, window.innerWidth | 0);
  const H = Math.max(1, window.innerHeight | 0);
  let w = W, h = Math.round(W / CFG.VIEW_ASPECT);
  if (h > H) { h = H; w = Math.round(H * CFG.VIEW_ASPECT); }
  return { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h };
}

const view = { x: 0, y: 0, w: 1, h: 1 };

function resizeRenderer() {
  const v = computeView();
  view.x = v.x; view.y = v.y; view.w = v.w; view.h = v.h;

  const dpr = Math.min(window.devicePixelRatio || 1, CFG.MAX_PIXEL_RATIO);
  renderer.setPixelRatio(dpr);
  renderer.setSize(v.w, v.h, false);

  const gl = renderer.domElement;
  gl.style.left = v.x + 'px';
  gl.style.top = v.y + 'px';
  gl.style.width = v.w + 'px';
  gl.style.height = v.h + 'px';

  // Fixed aspect and fixed FOV: the view never stretches and never reveals
  // more or less of the world because the window changed shape.
  camera.aspect = CFG.VIEW_ASPECT;
  camera.fov = CFG.FOV;
  camera.updateProjectionMatrix();
}

function updateScenery() {
  const camS = player.s - CFG.PLAYER_FRONT_OVERHANG;
  world.roadTex.offset.y = camS / WORLD.ROAD_TILE_M;
  world.wallTex.offset.x = camS / world.wallTileW;
  world.railTex.offset.x = camS / world.railTileW;
  // distant scenery crawls, so the hills stay put while the wall streams past
  if (world.backdropTex) {
    world.backdropTex.offset.x = camS * WORLD.BACKDROP_PARALLAX / world.backdropTileW;
  }

  // sign gantry: forever one mile away
  if (player.s > world.gantryS - 25) world.gantryS += WORLD.SIGN_RECYCLE_M;
  world.gantry.position.z = camS - world.gantryS;

  layoutScrapeDecals(camS);
}

function updateCamera(dt) {
  // sway: nose dives under braking, lifts under power (GDD §3, ±1-2°)
  const pitch = clamp(-player.accelFelt / CFG.BRAKE_FORCE, -1, 1) * CFG.CAM_SWAY_DEG;
  const roll  = clamp(-player.lateral / CFG.STEER_RATE, -1, 1) * CFG.CAM_SWAY_DEG * 0.45;

  let ox = 0, oy = 0;
  if (shakeAmt > 0.001) {
    shakeT += dt * 60;
    ox = (Math.sin(shakeT * 2.7) + Math.sin(shakeT * 5.3)) * 0.035 * shakeAmt;
    oy = (Math.sin(shakeT * 3.9) + Math.sin(shakeT * 7.1)) * 0.030 * shakeAmt;
    shakeAmt *= Math.pow(0.02, dt);
  }

  // The eye rides with the car: player.x is the centreline, the driver sits
  // CAMERA_SEAT_OFFSET_X to the left of it. Without the player.x term, steering
  // moves the collision box but never the view.
  camera.position.set(player.x + CFG.CAMERA_SEAT_OFFSET_X + ox, CFG.CAMERA_HEIGHT + oy, 0);
  const tiltZ = state === 'over' ? 0.055 : 0;
  const basePitch = CFG.CAM_PITCH_DEG;
  camera.rotation.x = lerp(camera.rotation.x, (basePitch + pitch) * Math.PI / 180, 0.18);
  camera.rotation.z = lerp(camera.rotation.z, (roll * Math.PI / 180) + tiltZ, 0.12);
}

let last = performance.now();
let lastWinW = 0, lastWinH = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  // The tab may have been hidden (0x0) at boot, or rotated without firing
  // resize. Re-layout whenever the WINDOW actually changes — compare against
  // the window size, not ui.w/ui.h, which are the 16:9 view rect and rarely
  // equal the window.
  const vw = Math.max(1, window.innerWidth | 0), vh = Math.max(1, window.innerHeight | 0);
  if (vw !== lastWinW || vh !== lastWinH) {
    lastWinW = vw; lastWinH = vh;
    layoutUI(); resizeRenderer();
  }

  if (state === 'play' && !paused) {
    stats.time += dt;
    updatePlayer(dt);
    updateBlinkerDenial();
    for (const lane of lanes) updateLane(lane, dt);
    checkCollisions();
    updateHonking(dt);
    updateUnlocks(dt);
    updateEmote(dt);
    Audio.setEngine(player.speed, player.gas);
    if (player.brake > 0.55 && player.speed > AUDIO.BRAKE_SQUEAK_MIN_MPH * MPH) Audio.squeak();
  }

  updateScenery();
  updateCarVisuals();
  updateCamera(dt);

  renderer.render(scene, camera);
  drawOverlay();
}

// =============================================================================
//  BOOT
// =============================================================================

// Draw an image into a fresh canvas so its pixels are readable.
function toCanvas(img) {
  const c = makeCanvas(img.naturalWidth, img.naturalHeight);
  c.getContext('2d').drawImage(img, 0, 0);
  return c;
}

async function boot() {
  const glCanvas = document.getElementById('gl');
  renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  ui.canvas = document.getElementById('ui');
  ui.ctx = ui.canvas.getContext('2d');

  // ---- load whatever art exists; placeholder the rest ---------------------
  const [rearImg, img34, semiImg, frontsImg, cockpitImg,
         wheelImg, stereoImg, pedalsImg, roadImg, wallImg, signImg, titleImg,
         gpsImg, handImg, streakImg] = await Promise.all([
    loadImage(ASSETS.carsRear), loadImage(ASSETS.cars34), loadImage(ASSETS.semiRear),
    loadImage(ASSETS.fronts),   loadImage(ASSETS.cockpit), loadImage(ASSETS.wheel),
    loadImage(ASSETS.stereo),   loadImage(ASSETS.pedals),  loadImage(ASSETS.road),
    loadImage(ASSETS.wall),     loadImage(ASSETS.sign),    loadImage(ASSETS.title),
    loadImage(ASSETS.gps),      loadImage(ASSETS.hand),    loadImage(ASSETS.streak),
  ]);
  ART.cockpit = cockpitImg;
  ART.wheel   = wheelImg;
  ART.stereo  = stereoImg;
  ART.pedals  = pedalsImg;
  ART.road    = roadImg;
  ART.wall    = wallImg;
  ART.sign    = signImg;
  ART.title   = titleImg;   // reused by the share card

  // music availability probe
  ART.musicOk = await new Promise(res => {
    const a = new window.Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => res(true);
    a.onerror = () => { console.info(`[assets] missing "${ASSETS.music}" — stereo will play a placeholder riff`); res(false); };
    a.src = ASSETS.music;
  });

  // ---- title logo ---------------------------------------------------------
  if (titleImg) {
    const slot = document.getElementById('titleArt');
    if (slot) {
      slot.src = ASSETS.title;
      slot.hidden = false;
      const txt = document.getElementById('titleText');
      if (txt) txt.hidden = true;
    }
  }

  // ---- car atlas (rear) ---------------------------------------------------
  const rearCanvas = rearImg ? toCanvas(rearImg) : buildCarAtlasPlaceholder('rear');
  {
    const cells = segmentSheet(rearCanvas, SEGMENT.carsRear.rows, SEGMENT.carsRear.perRow);
    const found = cells.length;
    if (found !== 32) console.warn(`[assets] Car_Rears_Sprite: segmented ${found} cells, expected 32`);
    // repaint the AI-gibberish bumper sticker before the texture is uploaded
    if (rearImg) stampSticker(rearCanvas.getContext('2d'), cells);
    carAtlas = { texture: textureFrom(rearCanvas), variants: buildCarVariants(rearCanvas, cells) };
    console.info(`[assets] rear atlas: ${found} cells -> ${carAtlas.variants.length} variants`);
  }

  // ---- car atlas (rear-3/4) ----------------------------------------------
  if (img34) {
    const c34 = toCanvas(img34);
    const cells = segmentSheet(c34, SEGMENT.cars34.rows, SEGMENT.cars34.perRow);
    if (cells.length !== 32) console.warn(`[assets] Car_rear_Turned: segmented ${cells.length} cells, expected 32`);
    const variants = buildCarVariants(c34, cells, { turned: true });
    car34Atlas = { texture: textureFrom(c34), variants, byKey: {} };
    for (const v of variants) car34Atlas.byKey[v.type + '|' + v.colour] = v;
    console.info(`[assets] rear-3/4 atlas: ${cells.length} cells -> ${variants.length} variants`);
  }

  // ---- semi ---------------------------------------------------------------
  {
    const semiCanvas = semiImg ? toCanvas(semiImg) : buildSemiAtlasPlaceholder();
    const cells = segmentSheet(semiCanvas, SEGMENT.semiRear.rows, SEGMENT.semiRear.perRow);
    if (cells.length < 2) console.warn(`[assets] Truck_Rear: segmented ${cells.length} cells, expected 2`);
    semiAtlas = {
      texture: textureFrom(semiCanvas),
      variant: buildPairVariant(semiCanvas, cells, SEMI.width, {
        type: 'semi', colour: 'white',
        width: SEMI.width, height: SEMI.height, length: SEMI.length,
      }),
    };
  }

  // ---- fronts (rearview mirror dressing) ---------------------------------
  ART.frontsCanvas = frontsImg ? toCanvas(frontsImg) : buildFrontsAtlasPlaceholder();
  ART.frontsCells  = segmentSheet(ART.frontsCanvas, SEGMENT.fronts.rows, SEGMENT.fronts.perRow);
  if (ART.frontsCells.length !== FRONTS.ORDER.length) {
    console.warn(`[assets] Car_Fronts: segmented ${ART.frontsCells.length} vehicles, expected ${FRONTS.ORDER.length}`);
  }

  // ---- stereo / pedals ----------------------------------------------------
  if (stereoImg) {
    ART.stereoCells = segmentSheet(toCanvas(stereoImg), SEGMENT.stereo.rows, SEGMENT.stereo.perRow);
    if (ART.stereoCells.length < 2) console.warn('[assets] Stereo.png: expected 2 cells');
  }
  if (pedalsImg) {
    ART.pedalCells = segmentSheet(toCanvas(pedalsImg), SEGMENT.pedals.rows, SEGMENT.pedals.perRow);
    if (ART.pedalCells.length < 4) console.warn('[assets] Pedals.png: expected 4 cells');
  }

  // ---- GPS unit (JEFF PASS) ----------------------------------------------
  // 2 cells: off / on. The ON cell's screen is flat magenta — a chroma key.
  // We never draw the magenta: its measured rect is where the live map goes,
  // painted opaquely over it.
  if (gpsImg) {
    ART.gpsCanvas = toCanvas(gpsImg);
    const cells = segmentSheet(ART.gpsCanvas, 1, [2]);
    if (cells.length >= 2) {
      ART.gpsOn = cells[1].glow ? {
        x0: cells[1].glow.x0, y0: cells[1].glow.y0,
        w: cells[1].glow.w, h: cells[1].glow.h,
      } : null;
      if (ART.gpsOn) {
        // find the magenta key inside the ON cell
        const c = ART.gpsCanvas.getContext('2d', { willReadFrequently: true });
        const d = c.getImageData(ART.gpsOn.x0, ART.gpsOn.y0, ART.gpsOn.w, ART.gpsOn.h).data;
        let mx0 = 1e9, my0 = 1e9, mx1 = -1, my1 = -1;
        for (let y = 0; y < ART.gpsOn.h; y++) {
          for (let x = 0; x < ART.gpsOn.w; x++) {
            const i = (y * ART.gpsOn.w + x) << 2;
            if (d[i] > 180 && d[i + 2] > 180 && d[i + 1] < 130) {
              if (x < mx0) mx0 = x; if (x > mx1) mx1 = x;
              if (y < my0) my0 = y; if (y > my1) my1 = y;
            }
          }
        }
        if (mx1 > mx0) {
          ART.gpsScreen = {
            x: mx0 / ART.gpsOn.w, y: my0 / ART.gpsOn.h,
            w: (mx1 - mx0 + 1) / ART.gpsOn.w, h: (my1 - my0 + 1) / ART.gpsOn.h,
          };
          console.info('[assets] GPS art active, screen key found');
        } else {
          console.warn('[assets] GPS.png: no magenta screen key found — using placeholder unit');
          ART.gpsOn = null;
        }
      }
    }
  }

  // ---- thumbs-up hand (JEFF PASS): 3 frames, rise / hold / present --------
  if (handImg) {
    ART.handCanvas = toCanvas(handImg);
    ART.handCells = segmentSheet(ART.handCanvas, 1, [3]);
    if (ART.handCells.length < 3) {
      console.warn(`[assets] ThumbsUp.png: expected 3 frames, segmented ${ART.handCells.length} — using placeholder hand`);
      ART.handCells = null;
    } else {
      console.info('[assets] thumbs-up art active (3 frames)');
    }
  }

  // ---- wall-scrape decal (JEFF PASS): single wide streak ------------------
  if (streakImg) {
    ART.streakCanvas = toCanvas(streakImg);
    const c = ART.streakCanvas.getContext('2d', { willReadFrequently: true });
    const d = c.getImageData(0, 0, ART.streakCanvas.width, ART.streakCanvas.height).data;
    ART.streakBox = alphaBBox(d, ART.streakCanvas.width,
                              0, 0, ART.streakCanvas.width, ART.streakCanvas.height, 16);
    if (ART.streakBox) {
      console.info(`[assets] scrape decal active (${ART.streakBox.w}x${ART.streakBox.h} content)`);
    } else {
      console.warn('[assets] StreakCrash.png: no visible content — bare smear fallback');
      ART.streakCanvas = null;
    }
  }

  // ---- steering wheel pivot ----------------------------------------------
  if (wheelImg) {
    const wc = toCanvas(wheelImg);
    const W = wc.width, H = wc.height;
    const d = wc.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const b = alphaBBox(d, W, 0, 0, W, H, 16);
    if (b) {
      // rotate about the rim's bounding-box centre, not the canvas centre
      ART.wheelPivot = { cx: b.x0 + b.w / 2, cy: b.y0 + b.h / 2, size: Math.max(b.w, b.h) };
      const dx = (b.x0 + b.w / 2) - W / 2, dy = (b.y0 + b.h / 2) - H / 2;
      console.info(`[assets] wheel pivot offset ${dx.toFixed(1)}, ${dy.toFixed(1)} px — corrected`);
    }
  }

  buildScene();
  resizeRenderer();
  layoutUI();
  buildTraffic();
  bindInput();

  document.getElementById('start').addEventListener('click', startGame);
  document.getElementById('ignition').addEventListener('click', e => { e.stopPropagation(); startGame(); });
  document.getElementById('shareBtn').addEventListener('click', e => {
    e.stopPropagation();   // must stay inside the gesture for navigator.share
    doShare();
  });

  // Debug handle. `stepSim` advances the simulation without rendering, which
  // makes the wave engine testable at fixed timesteps instead of by eye.
  window.__ts3 = {
    player, lanes, stats, input, Audio, CFG, ART, carAtlas, car34Atlas, semiAtlas,
    share, superlativeFor, buildShareCard, drawShareCard, doShare, shareURL,
    get state() { return state; },
    begin: () => startGame(),
    stepSim(dt) {
      stats.time += dt;
      updatePlayer(dt);
      updateBlinkerDenial();
      for (const lane of lanes) updateLane(lane, dt);
      checkCollisions();
      updateHonking(dt);
      updateUnlocks(dt);
      updateEmote(dt);
    },
    gps, unlocks, emote, triggerEmote,
  };

  requestAnimationFrame(frame);
}

boot();