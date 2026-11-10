import { levelAt } from '../../src/data.js';

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
// The book's springs were tuned at screen refresh rate: two steps per frame keep their snap.
export const SUBSTEPS = 2;

// The film is one day in the book. Every time below is in seconds.
export const T = {
  intro: 0.7, introOut: 3.6,
  open: 4.0, openTime: 1.9, pop: 5.2, loose: 6.35, crowd: 6.5,
  lake: 10.8, day: 11.3, dayTime: 6.0, plein: 17.8, lakeOut: 19.0,
  redirect: 19.6, la: 25.8, settle: 31.2, chemin: 31.7, cheminOut: 35.6,
  besoins: 37.4, heroes: [38.0, 39.7, 41.4, 43.1], besoinsOut: 44.6,
  gestionnaire: 46.6, niveau: 48.4, publish: 50.0, gestionnaireOut: 52.8,
  kiosk: 55.2, widget: 55.6, paste: 56.6, board: 57.4, partners: [58.8, 59.9, 61.0, 62.1], widgetOut: 63.2,
  moment: 65.2, dusk: 65.6, duskTime: 5.4, momentOut: 71.4,
  bow: 72.8, fold: 75.2, close: 76.6, closeTime: 1.9,
  end: 79.0,
};
export const DURATION = 84.8;
export const FRAMES = Math.round(DURATION * FPS);

// The block of the image where words are laid on the table, beside the closed book.
export const WORDS = { left: 96, width: 740, top: 240, height: 600 };

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Constant speed with soft ends: how the sun arm travels. */
function glide(x, e = 0.18) {
  const v = 1 / (1 - e);
  if (x < e) return (v * x * x) / (2 * e);
  if (x > 1 - e) return 1 - (v * (1 - x) * (1 - x)) / (2 * e);
  return v * (x - e / 2);
}

export function hourAt(t) {
  if (t < T.dusk) return 8 + 7 * glide(clamp01((t - T.day) / T.dayTime));
  return 15 + 5 * glide(clamp01((t - T.dusk) / T.duskTime));
}

export const coverAt = (t) => (t < T.fold ? ease(clamp01((t - T.open) / T.openTime)) : 1 - ease(clamp01((t - T.close) / T.closeTime)));
export const looseAt = (t) => (t < T.fold ? ease(clamp01((t - T.loose) / 0.8)) : 1 - ease(clamp01((t - T.fold) / 0.5)));

/** Front rows fold first when the book closes, the way a hand would flatten them. */
export const foldDelay = (z) => (7 - z) * 0.045;

/** When the forecast level changes, for the labels that mark it. */
export const LEVEL_TURNS = [];
for (let f = 1; f < FRAMES; f++) {
  const level = levelAt(hourAt(f / FPS));
  if (level !== levelAt(hourAt((f - 1) / FPS))) LEVEL_TURNS.push({ t: f / FPS, level });
}

// ---- Camera ------------------------------------------------------------------

const FOV = 30;
const RAD = Math.PI / 180;

/**
 * A camera pose from a framing: `span` is the width and height of the scene
 * that must fit in the part of the image the `inset` leaves free.
 */
function pose({ target, az, el, span, blur }, inset = {}) {
  const { left = 0, right = 0, top = 0, bottom = 0 } = inset;
  const dist = Math.max((span[0] * HEIGHT) / (WIDTH - left - right), (span[1] * HEIGHT) / (HEIGHT - top - bottom)) / (2 * Math.tan((FOV * RAD) / 2));
  return { tx: target[0], ty: target[1], tz: target[2], az: az * RAD, el: el * RAD, dist, sx: (right - left) / 2, sy: (bottom - top) / 2, blur };
}

// The four Éclaireurs stand evenly spaced for their parade.
export const HEROES = { chapeau: -3.45, canne: -1.15, fauteuil: 1.15, chien: 3.45 };

// The film's own framings, composed for its 16:9 image: the presentation's stops
// are tuned around its panel and may move without the film following.
const closed = { target: [5.6, 0.25, 0.2], az: 10, el: 54, span: [19.5, 16.5], blur: 0.5 };
const wide = { target: [0, 1.5, -0.2], az: 3, el: 30, span: [30, 14.6], blur: 0.5 };
const lake = { target: [-5, 0.5, 2.4], az: 17, el: 30, span: [9.4, 5.6], blur: 0.7 };
const path = { target: [1, 0.4, 4.4], az: 5, el: 33, span: [12, 6.8], blur: 0.6 };
const pond = { target: [7.1, 0.6, 4.1], az: -10, el: 27, span: [8.8, 5], blur: 0.7 };
const both = { target: [1, 0.4, 2.6], az: 4, el: 41, span: [20.5, 10.6], blur: 0.45 };
const shelf = { target: [8, 1.9, -3], az: 15, el: 24, span: [8.2, 6.2], blur: 0.7 };
const office = { target: [-8.8, 1.45, 4.9], az: -14, el: 15, span: [6.2, 4.4], blur: 0.75 };
// Crossing the whole book in one move: the lens rises so the pages do not streak past.
const over = { target: [-0.4, 1.7, 1], az: 0, el: 22, span: [13, 7.4], blur: 0.5 };
const aside = { left: 760 };

// The parade walks at one Éclaireur every 1.7 s, each a little ahead of the lens when it stands up.
const pace = (HEROES.canne - HEROES.chapeau) / (T.heroes[1] - T.heroes[0]);
const parade = (after, x = HEROES.chapeau - 0.9 + pace * after) =>
  [T.heroes[0] + after, pose({ target: [x, 1.45, 6], az: 5 - after * 1.5, el: 10, span: [5.4, 3.2], blur: 0.9 }, aside)];

const KEYS = [
  [0, pose(closed, aside)],
  [T.open, pose({ ...closed, span: [18.8, 15.9] }, aside)],
  [6.6, pose(wide)],
  [8.6, pose({ ...wide, az: 1, span: [29, 14.1] })],
  [T.lake, pose(lake, aside)],
  [T.lakeOut + 0.4, pose({ ...lake, az: 14 }, aside)],
  [22.4, pose(path)],
  [25.4, pose(pond)],
  [27.6, pose({ ...pond, az: -8 })],
  [29.8, pose(both, { bottom: 120 })],
  [T.cheminOut, pose({ ...both, az: 2 }, { bottom: 120 })],
  parade(-0.4, HEROES.chapeau - 1.3),
  parade(0.8),
  parade(2.2),
  parade(3.6),
  parade(5.1),
  parade(6.5, HEROES.chien - 0.2),
  [T.gestionnaire + 0.2, pose(shelf, aside)],
  [T.gestionnaireOut, pose({ ...shelf, az: 11 }, aside)],
  [54.2, pose(over, aside)],
  [T.widget, pose(office, aside)],
  [T.widgetOut + 0.1, pose({ ...office, az: -10 }, aside)],
  [T.moment, pose({ ...lake, az: 15 }, aside)],
  [T.momentOut + 0.2, pose({ ...lake, az: 18 }, aside)],
  [T.bow + 1, pose(wide)],
  [T.close, pose({ ...wide, az: 1 })],
  [T.close + T.closeTime + 0.2, pose(closed, aside)],
  [DURATION, pose({ ...closed, span: [18.8, 15.9] }, aside)],
];

/** Monotone cubic interpolation: no overshoot, and speed carries through each key. */
function pchip(xs, ys) {
  const n = xs.length;
  const h = [], d = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(xs[i + 1] - xs[i]);
    d.push((ys[i + 1] - ys[i]) / h[i]);
  }
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) continue;
    const a = 2 * h[i] + h[i - 1], b = h[i] + 2 * h[i - 1];
    m[i] = (a + b) / (a / d[i - 1] + b / d[i]);
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const u = (x - xs[i]) / h[i], u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h[i] * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h[i] * m[i + 1];
  };
}

const times = KEYS.map(([t]) => t);
const channels = Object.fromEntries(Object.keys(KEYS[0][1]).map((k) => [k, pchip(times, KEYS.map(([, p]) => p[k]))]));

export function cameraAt(t) {
  const p = {};
  for (const k in channels) p[k] = channels[k](t);
  // A slow breath of parallax, as when nobody is touching the book.
  p.az += Math.sin(t * 0.23) * 0.03;
  p.el += Math.sin(t * 0.17 + 1) * 0.007;
  return p;
}

// ---- One-shot events ---------------------------------------------------------

export const EVENTS = [
  ...[[-5.6, 2.5, -5.5], [5.6, 3, -5.5], [-5.6, 0.6, 1], [3.2, 2, -0.9], [0, 1, 5.5]].map((at, i) => ({ t: T.open + 1.5 + i * 0.22, burst: { at, count: 22, power: 1.25 } })),
  // Twelve leave: enough for the lake to drop from saturé to chargé, few enough for the pond to stay easy.
  { t: T.redirect, redirect: 12 },
  ...Object.keys(HEROES).flatMap((hero, i) => [{ t: T.heroes[i] + 0.5, hop: hero }, { t: T.bow + i * 0.12 + 0.5, hop: hero }]),
  { t: T.publish, signal: true },
  { t: T.board, burst: { at: [-8.45, 2.2, 5.9], count: 26, power: 1 } },
  // The widget tries on the demonstration partners in turn. For the bow, the office wears the application's own colours.
  ...['grenoble-alpes-tourisme', 'chartreuse', 'alpes-isere', 'societe-lac-paladru'].map((partner, i) => ({ t: T.partners[i], partner })),
  { t: T.bow - 0.2, partner: 'plutot-la', quiet: true },
].sort((a, b) => a.t - b.t);

// ---- What the labels hold on to ---------------------------------------------

export const POINTS = {
  paladru: [-5.6, 1.5, 1.4],
  sauget: [7.3, 1.7, 3.3],
  lauvitel: [8, 2.8, -3.6],
  plein: [-5.6, 1.1, 1.2],
  la: [7.3, 0.9, 3.4],
  chapeau: [HEROES.chapeau, 1.85, 6],
  canne: [HEROES.canne, 1.95, 6],
  fauteuil: [HEROES.fauteuil, 2.1, 6],
  chien: [HEROES.chien, 1.85, 6],
};
