import { C, svg } from './paper.js';

// Scenery is authored at 100 px per world unit, in the same language as the
// product's own illustrations: flat brand colours, a round ink outline.
export const PX = 0.01;
const INK = 5;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (v) => Math.round(v * 10) / 10;
const pts = (list) => list.map(([x, y]) => `${n(x)},${n(y)}`).join(' L');

/** A cut-paper mountain range: jagged skyline, a shaded face per peak, snow on the high ones. */
export function ridge({ w, h, peaks, seed = 1, fill, shade, snow = 0, snowFrom = 0.72, foot = 20 }) {
  const r = rng(seed);
  const H = h + foot;
  const top = (hh) => H - foot - hh;
  const P = [];
  for (let i = 0; i < peaks; i++) P.push([((i + 0.5 + (r() - 0.5) * 0.55) / peaks) * w, h * (0.58 + 0.42 * r())]);
  P[Math.floor(r() * peaks)][1] = h;
  const V = [];
  for (let i = 0; i <= peaks; i++) {
    const a = P[i - 1], b = P[i];
    const x = !a ? 0 : !b ? w : a[0] + (b[0] - a[0]) * (0.4 + 0.2 * r());
    const low = Math.min(a ? a[1] : b[1], b ? b[1] : a[1]);
    V.push([x, low * (0.3 + 0.28 * r())]);
  }
  const sky = [];
  for (let i = 0; i < peaks; i++) sky.push([V[i][0], top(V[i][1])], [P[i][0], top(P[i][1])]);
  sky.push([V[peaks][0], top(V[peaks][1])]);

  let body = `<path d="M0,${H} L${pts(sky)} L${w},${H} Z" fill="${fill}" stroke="${C.encre}" stroke-width="${INK}"/>`;
  for (let i = 0; i < peaks; i++) {
    const [px, ph] = P[i];
    const [vx, vh] = V[i + 1];
    const py = top(ph), vy = top(vh);
    if (shade) body += `<path d="M${pts([[px, py + 8], [vx - 4, vy + 6], [vx - 4, H - 4], [px + (vx - px) * 0.32, H - 4]])} Z" fill="${shade}"/>`;
    if (snow && ph > h * snowFrom) {
      const [lx, lh] = V[i];
      const t = snow * (0.8 + 0.4 * r());
      const L = [px + (lx - px) * t, py + (top(lh) - py) * t];
      const R = [px + (vx - px) * t, py + (vy - py) * t];
      const teeth = [];
      for (let k = 1; k < 6; k++) {
        const u = k / 6;
        teeth.push([R[0] + (L[0] - R[0]) * u, R[1] + (L[1] - R[1]) * u + (k % 2 ? 16 : -10) * (0.7 + 0.6 * r())]);
      }
      body += `<path d="M${pts([L, [px, py], R, ...teeth])} Z" fill="${C.papier}" stroke="${C.encre}" stroke-width="${INK * 0.8}"/>`;
    }
  }
  return svg(w, H, body);
}

/** Rounded foothills. */
export function hills({ w, h, bumps, seed = 1, fill, shade, foot = 16 }) {
  const r = rng(seed);
  const H = h + foot;
  let d = `M0,${H} L0,${n(H - foot - h * (0.3 + 0.3 * r()))}`;
  let face = '';
  for (let i = 0; i < bumps; i++) {
    const x0 = (i / bumps) * w, x1 = ((i + 1) / bumps) * w;
    const hh = h * (0.62 + 0.38 * r());
    const end = H - foot - h * (i === bumps - 1 ? 0.3 + 0.3 * r() : 0.18 + 0.22 * r());
    const cx = x0 + (x1 - x0) * (0.4 + 0.2 * r());
    d += ` Q${n(cx)},${n(H - foot - hh * 1.75)} ${n(x1)},${n(end)}`;
    if (shade) face += `<path d="M${n(cx + 10)},${n(H - foot - hh * 0.78)} Q${n(x1 - 6)},${n(H - foot - hh * 0.7)} ${n(x1 - 4)},${H - 4} L${n(cx + (x1 - cx) * 0.4)},${H - 4} Z" fill="${shade}"/>`;
  }
  d += ` L${w},${H} Z`;
  return svg(w, H, `<path d="${d}" fill="${fill}" stroke="${C.encre}" stroke-width="${INK}"/>${face}`);
}

export function fir(fill = C.sapinFonce, tiers = 3) {
  const w = 100, step = 46, H = tiers * step + 30;
  let d = `M50,4`;
  const right = [], left = [];
  for (let i = 0; i < tiers; i++) {
    const spread = 26 + i * 9;
    const y = (i + 1) * step;
    right.push(`L${50 + spread},${y}`, i < tiers - 1 ? `L${50 + spread - 15},${y}` : '');
    left.unshift(i < tiers - 1 ? `L${50 - spread + 15},${y}` : '', `L${50 - spread},${y}`);
  }
  d += right.join(' ') + ' ' + left.join(' ') + ' Z';
  return svg(w, H, `<rect x="43" y="${tiers * step - 4}" width="14" height="32" fill="${C.encreHaute}" stroke="${C.encre}" stroke-width="${INK}"/><path d="${d}" fill="${fill}" stroke="${C.encre}" stroke-width="${INK}"/>`);
}

export function leafTree(fill = C.sauge) {
  return svg(140, 190, `<rect x="62" y="120" width="16" height="66" fill="${C.corailFonce}" stroke="${C.encre}" stroke-width="${INK}"/>
    <path d="M70,8 C104,6 132,32 128,66 C140,96 112,132 70,128 C28,132 0,96 12,66 C8,32 36,6 70,8 Z" fill="${fill}" stroke="${C.encre}" stroke-width="${INK}"/>
    <path d="M84,40 C100,46 108,62 104,80" fill="none" stroke="${C.saugeFonce}" stroke-width="${INK}"/>`);
}

export function reeds(seed = 1) {
  const r = rng(seed);
  let body = '';
  for (let i = 0; i < 7; i++) {
    const x = 16 + i * 22 + (r() - 0.5) * 10;
    const top = 30 + r() * 50;
    const bend = (r() - 0.5) * 22;
    body += `<path d="M${n(x)},150 Q${n(x + bend * 0.2)},${n((150 + top) / 2)} ${n(x + bend)},${n(top + 26)}" fill="none" stroke="${C.saugeFonce}" stroke-width="5"/>`;
    if (i % 2 === 0) body += `<rect x="${n(x + bend - 6)}" y="${n(top)}" width="12" height="34" rx="6" fill="${C.corailFonce}" stroke="${C.encre}" stroke-width="4"/>`;
    else body += `<path d="M${n(x + bend)},${n(top + 28)} q-14,-18 -4,-40 q14,18 4,40 Z" fill="${C.sauge}" stroke="${C.encre}" stroke-width="4"/>`;
  }
  return svg(180, 154, body);
}

/** One row of the paper sea. */
export function waves({ w, crest = 26, fill = C.lagon, seed = 1 }) {
  const r = rng(seed);
  const H = 64;
  const count = Math.round(w / 86);
  let d = `M0,${H} L0,${crest}`;
  for (let i = 0; i < count; i++) {
    const x0 = (i / count) * w, x1 = ((i + 1) / count) * w, mid = (x0 + x1) / 2;
    d += ` Q${n(mid)},${n(crest - 26 - r() * 8)} ${n(x1)},${crest}`;
  }
  d += ` L${w},${H} Z`;
  let foam = '';
  for (let i = 0; i < count; i += 2) {
    const x = ((i + 0.5) / count) * w;
    foam += `<path d="M${n(x - 22)},${crest + 16} q11,-9 22,0 q11,9 22,0" fill="none" stroke="${C.papier}" stroke-width="4.5"/>`;
  }
  return svg(w, H, `<path d="${d}" fill="${fill}" stroke="${C.encre}" stroke-width="${INK}"/>${foam}`);
}

export function cloud() {
  return svg(260, 130, `<path d="M56,112 C20,112 8,70 44,60 C40,24 96,8 116,40 C140,12 204,24 196,66 C240,62 252,112 208,112 Z" fill="${C.papier}" stroke="${C.encre}" stroke-width="${INK}"/>
    <path d="M70,92 C92,100 150,100 190,90" fill="none" stroke="${C.ciel}" stroke-width="7"/>`);
}

/** The hill the Bastille stands on, with the zigzag footpath up its face. */
export function fortHill() {
  return svg(460, 300, `<path d="M0,300 L0,236 Q70,214 120,150 Q170,58 236,44 Q318,40 356,128 Q396,206 460,232 L460,300 Z" fill="${C.sauge}" stroke="${C.encre}" stroke-width="${INK}"/>
    <path d="M250,60 Q322,60 350,136 Q384,208 452,236 L452,296 L318,296 Q300,180 250,60 Z" fill="${C.saugeFonce}" opacity="1"/>
    <path d="M96,292 L190,250 L120,214 L226,178 L166,146 L240,112" fill="none" stroke="${C.papier}" stroke-width="7" stroke-dasharray="2 15"/>
    <path d="M40,262 q14,-22 28,0 Z M388,268 q14,-22 28,0 Z M300,236 q12,-20 24,0 Z" fill="${C.sapinFonce}" stroke="${C.encre}" stroke-width="4"/>`);
}

/** The « bulles »: Grenoble's round cable-car cabins. */
export function bubble(fill = C.papier) {
  return svg(96, 120, `<path d="M48,6 L48,30" fill="none" stroke="${C.encre}" stroke-width="6"/>
    <circle cx="48" cy="72" r="40" fill="${fill}" stroke="${C.encre}" stroke-width="${INK}"/>
    <path d="M10,62 A40,40 0 0 1 86,62 Z" fill="${C.ciel}" stroke="${C.encre}" stroke-width="${INK}"/>
    <path d="M48,24 L48,62" fill="none" stroke="${C.encre}" stroke-width="4"/>
    <path d="M14,88 Q48,104 82,88" fill="none" stroke="${C.corail}" stroke-width="7"/>`);
}

export function station() {
  return svg(230, 190, `<rect x="14" y="74" width="202" height="112" fill="${C.creme}" stroke="${C.encre}" stroke-width="${INK}"/>
    <path d="M4,78 L115,10 L226,78 Z" fill="${C.corail}" stroke="${C.encre}" stroke-width="${INK}"/>
    <path d="M70,186 L70,118 Q115,84 160,118 L160,186 Z" fill="${C.encre}"/>
    <rect x="28" y="100" width="28" height="34" rx="4" fill="${C.ciel}" stroke="${C.encre}" stroke-width="4"/>
    <rect x="174" y="100" width="28" height="34" rx="4" fill="${C.ciel}" stroke="${C.encre}" stroke-width="4"/>
    <circle cx="115" cy="50" r="12" fill="${C.papier}" stroke="${C.encre}" stroke-width="4"/>`);
}

export function houses(seed = 3) {
  const r = rng(seed);
  const fills = [C.creme, C.soleilClair, C.corailClair, C.saugeClair, C.papier];
  const roofs = [C.corail, C.sapin, C.corailFonce];
  let body = '';
  let x = 6;
  for (let i = 0; i < 6; i++) {
    const w = 50 + r() * 22, h = 62 + r() * 62, y = 190 - h;
    body += `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fills[i % fills.length]}" stroke="${C.encre}" stroke-width="${INK}"/>
      <path d="M${n(x - 5)},${n(y)} L${n(x + w / 2)},${n(y - 30 - r() * 14)} L${n(x + w + 5)},${n(y)} Z" fill="${roofs[i % roofs.length]}" stroke="${C.encre}" stroke-width="${INK}"/>`;
    for (let k = 0; k * 34 + 22 < h - 16; k++) body += `<rect x="${n(x + w / 2 - 9)}" y="${n(y + 16 + k * 34)}" width="18" height="20" rx="3" fill="${C.ciel}" stroke="${C.encre}" stroke-width="3.5"/>`;
    x += w - 2;
  }
  return svg(Math.ceil(x + 8), 194, body);
}

/** The tourist office: a kiosk with the round information sign. The awning is a separate sheet so it can take a partner's colour. */
export function kiosk() {
  return svg(260, 270, `<rect x="24" y="110" width="212" height="156" fill="${C.creme}" stroke="${C.encre}" stroke-width="${INK}"/>
    <path d="M12,112 L130,36 L248,112 Z" fill="${C.sapin}" stroke="${C.encre}" stroke-width="${INK}"/>
    <rect x="150" y="176" width="58" height="90" rx="6" fill="${C.sapinFonce}" stroke="${C.encre}" stroke-width="${INK}"/>
    <circle cx="198" cy="224" r="4.5" fill="${C.soleil}"/>
    <rect x="44" y="176" width="84" height="56" rx="6" fill="${C.ciel}" stroke="${C.encre}" stroke-width="${INK}"/>
    <path d="M86,176 L86,232 M44,204 L128,204" fill="none" stroke="${C.encre}" stroke-width="4"/>
    <circle cx="130" cy="82" r="21" fill="${C.papier}" stroke="${C.encre}" stroke-width="${INK}"/>
    <circle cx="130" cy="72" r="4.2" fill="${C.encre}"/>
    <path d="M130,81 L130,95" fill="none" stroke="${C.encre}" stroke-width="6.5"/>`);
}

export function awning(fill) {
  let stripes = '';
  for (let i = 0; i < 5; i++) stripes += `<path d="M${14 + i * 48},10 L${38 + i * 48},10 L${34 + i * 48},48 L${10 + i * 48},48 Z" fill="${C.papier}" opacity="1"/>`;
  return svg(250, 62, `<path d="M10,6 L240,6 L246,42 q-23,18 -46,0 q-23,18 -46,0 q-23,18 -46,0 q-23,18 -46,0 q-23,18 -46,0 Z" fill="${fill}" stroke="${C.encre}" stroke-width="${INK}"/>`);
}

/** The rock shelf that holds the lac du Lauvitel, seen side-on the way the product draws its lakes. */
export function lauvitelShelf() {
  return svg(520, 250, `<path d="M0,250 L0,150 L46,96 L108,120 L150,70 L372,70 L412,116 L470,92 L520,150 L520,250 Z" fill="${C.sapinClair}" stroke="${C.encre}" stroke-width="${INK}"/>
    <path d="M150,70 L372,70 L412,116 L404,246 L300,246 Z" fill="${C.sapin}" opacity="0.55"/>
    <path d="M132,86 Q260,54 392,86 Q376,128 260,132 Q146,128 132,86 Z" fill="${C.lagon}" stroke="${C.encre}" stroke-width="${INK}"/>
    <path d="M176,96 q14,-10 28,0 q14,10 28,0 M270,110 q14,-10 28,0 q14,10 28,0" fill="none" stroke="${C.papier}" stroke-width="4.5"/>
    <path d="M60,250 L92,176 L132,250 Z M420,250 L452,186 L488,250 Z" fill="${C.sapinFonce}" stroke="${C.encre}" stroke-width="4"/>`);
}

/** What a site manager plants when the place is full. */
export function fullSign() {
  return svg(170, 250, `<rect x="78" y="120" width="14" height="126" fill="${C.creme}" stroke="${C.encre}" stroke-width="${INK}"/>
    <path d="M52,8 L118,8 L162,52 L162,108 L118,152 L52,152 L8,108 L8,52 Z" fill="${C.rouge}" stroke="${C.encre}" stroke-width="${INK}"/>
    <path d="M56,50 L114,110 M114,50 L56,110" fill="none" stroke="${C.papier}" stroke-width="15"/>`);
}

export function parkingSign() {
  return svg(110, 210, `<rect x="48" y="96" width="14" height="110" fill="${C.creme}" stroke="${C.encre}" stroke-width="${INK}"/>
    <rect x="8" y="8" width="94" height="94" rx="14" fill="${C.sapin}" stroke="${C.encre}" stroke-width="${INK}"/>
    <path d="M42,80 L42,30 L58,30 Q76,30 76,46 Q76,62 58,62 L42,62" fill="none" stroke="${C.papier}" stroke-width="11"/>`);
}

/** A thin card strip: the arm that carries the sun, a cloud or a paraglider. */
export function strip(w, h, fill = C.creme) {
  return svg(w, h, `<rect x="3" y="3" width="${w - 6}" height="${h - 6}" rx="${Math.min(w, h) / 2 - 3}" fill="${fill}" stroke="${C.encre}" stroke-width="4"/>`);
}

export function pontoon() {
  let posts = '';
  for (let i = 0; i < 5; i++) posts += `<rect x="${20 + i * 70}" y="40" width="14" height="60" fill="${C.corailFonce}" stroke="${C.encre}" stroke-width="4"/>`;
  return svg(340, 104, `${posts}<rect x="6" y="22" width="328" height="24" rx="5" fill="${C.sable}" stroke="${C.encre}" stroke-width="${INK}"/>`);
}
