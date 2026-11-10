import { rng } from './scenery.js';

// The open spread, in world units: x across (the gutter is x = 0), z toward the reader.
export const PAGE = { w: 11, d: 14 };

function blob(cx, cz, rx, rz, tilt, seed, wobble = 0.1, count = 56) {
  const r = rng(seed);
  const phase = [r() * 6.28, r() * 6.28, r() * 6.28];
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const k = 1 + wobble * (Math.sin(a * 2 + phase[0]) * 0.5 + Math.sin(a * 3 + phase[1]) * 0.35 + Math.sin(a * 5 + phase[2]) * 0.15);
    const x = Math.cos(a) * rx * k, z = Math.sin(a) * rz * k;
    out.push([cx + x * Math.cos(tilt) - z * Math.sin(tilt), cz + x * Math.sin(tilt) + z * Math.cos(tilt)]);
  }
  return out;
}

export const PALADRU = { cx: -5.7, cz: 0.9, rx: 3.5, rz: 1.7 };
export const SAUGET = { cx: 7.3, cz: 3.5, rx: 1.75, rz: 0.95 };
export const paladruShore = blob(PALADRU.cx, PALADRU.cz, PALADRU.rx, PALADRU.rz, -0.1, 7, 0.09);
export const saugetShore = blob(SAUGET.cx, SAUGET.cz, SAUGET.rx, SAUGET.rz, 0.12, 21, 0.14, 40);

// The printed path from the full lake to the quieter pond: « le chemin ».
export const CHEMIN = [
  [-3.1, 4.72], [-1.5, 5.12], [0.8, 5.2], [3.1, 5.05], [5.2, 4.78],
];

export const ISERE = [
  [11.4, -1.6], [8.6, -0.6], [6.4, 0.5], [4.4, 1.15], [2.2, 1.0], [0, 0.35], [-1.6, -1.2], [-3.4, -2.3], [-6.4, -2.75], [-9, -2.5], [-11.4, -3.1],
];

/** Where figurines can stand at each site, most natural spots first. */
function slots(make, seed) {
  const r = rng(seed);
  return make(r)
    .map((s) => ({ ...s, turn: (r() - 0.5) * 0.5, size: 0.9 + r() * 0.22 }))
    .sort((a, b) => a.rank - b.rank);
}

const paladruFront = (x) => {
  const t = (x - PALADRU.cx) / (PALADRU.rx * 1.04);
  return PALADRU.cz + PALADRU.rz * Math.sqrt(Math.max(0.05, 1 - t * t)) - (x - PALADRU.cx) * 0.1;
};

export const SLOTS = {
  paladru: slots((r) => {
    const out = [];
    for (let row = 0; row < 5; row++) {
      for (let x = -7.9 + (row % 2) * 0.22; x <= -2.6; x += 0.45) {
        const z = paladruFront(x) + 0.42 + row * 0.4 + (r() - 0.5) * 0.12;
        if (z > 4.75 || (x < -6.4 && z > 4.3)) continue;
        out.push({ x: x + (r() - 0.5) * 0.14, z, rank: row * 0.9 + Math.abs(x + 5.4) * 0.3 + r() * 1.1 });
      }
    }
    return out;
  }, 11),
  sauget: slots((r) => {
    const out = [];
    for (let row = 0; row < 3; row++) {
      for (let x = 5.5 + (row % 2) * 0.25; x <= 9.5; x += 0.5) {
        out.push({ x: x + (r() - 0.5) * 0.16, z: 4.75 + row * 0.38 + (r() - 0.5) * 0.1, rank: row + Math.abs(x - 7.3) * 0.35 + r() });
      }
    }
    return out;
  }, 5),
  lauvitel: slots((r) => {
    const out = [];
    for (let row = 0; row < 3; row++) {
      for (let x = 6.85 + (row % 2) * 0.2; x <= 9.45; x += 0.42) {
        out.push({ x: x + (r() - 0.5) * 0.14, z: -2.75 + row * 0.38 + (r() - 0.5) * 0.1, rank: row + Math.abs(x - 8.1) * 0.3 + r() });
      }
    }
    return out;
  }, 9),
};
