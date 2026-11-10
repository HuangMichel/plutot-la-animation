import * as THREE from 'three';
import { C } from './paper.js';
import { PAGE, PALADRU, SAUGET, paladruShore, saugetShore, CHEMIN, ISERE } from './layout.js';
import { rng } from './scenery.js';
import { LEVEL_COLOURS } from '../data.js';

const PPU = 128; // canvas pixels per world unit
const TITLE = '"Fredoka Variable", "Fredoka", system-ui, sans-serif';
const TEXT = '"Nunito Variable", "Nunito", system-ui, sans-serif';


function texture(canvas, renderer) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function smooth(ctx, points, closed) {
  const p = points;
  const len = p.length;
  const at = (i) => (closed ? p[(i + len) % len] : p[Math.max(0, Math.min(len - 1, i))]);
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]);
  const last = closed ? len : len - 1;
  for (let i = 0; i < last; i++) {
    const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
    ctx.bezierCurveTo(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6, c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6, c[0], c[1]);
  }
  if (closed) ctx.closePath();
}

/** One page of the spread, printed as a simplified map. `side` is -1 (left) or 1 (right). */
export function pagePrint(side, renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE.w * PPU;
  canvas.height = PAGE.d * PPU;
  const ctx = canvas.getContext('2d');
  const ox = side < 0 ? PAGE.w : 0;
  const px = ([x, z]) => [(x + ox) * PPU, (z + PAGE.d / 2) * PPU];
  const map = (list) => list.map(px);
  const u = PPU;

  ctx.fillStyle = C.creme;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Meadows and scree under the reliefs.
  const r = rng(side < 0 ? 31 : 47);
  const wash = (cx, cz, rx, rz, colour) => {
    const loop = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const k = 0.82 + r() * 0.36;
      loop.push(px([cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k]));
    }
    smooth(ctx, loop, true);
    ctx.fillStyle = colour;
    ctx.fill();
  };
  if (side < 0) {
    wash(-5.6, -4.6, 6.4, 2.6, '#E6F0DC');
    wash(-9.2, 1.2, 1.9, 3.2, '#EBF1E1');
    wash(-1.6, -2.4, 1.9, 1.5, '#EBF1E1');
    wash(-5.5, 3.5, 3.9, 1.25, C.sable);
  } else {
    wash(5.6, -4.9, 6.2, 2.5, '#DFEDE8');
    wash(3.3, -1.2, 2.9, 1.5, '#E6F0DC');
    wash(7.4, 3.7, 3.3, 2.2, '#E6F0DC');
    wash(8.2, -2.3, 2.6, 0.95, '#F1E7D2');
  }

  // Contour lines, the way a walking map draws slopes.
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(11, 53, 64, 0.085)';
  const contours = side < 0 ? [[-6.2, -5.2, 4.6, 1.5], [-9.3, -1.4, 1.5, 1.1], [-1.9, -3.4, 1.4, 1.0]] : [[5.9, -5.4, 4.6, 1.5], [3.2, -1.1, 2.2, 0.95], [9.4, 0.6, 1.3, 1.0]];
  for (const [cx, cz, rx, rz] of contours) {
    const seedLoop = Array.from({ length: 16 }, () => 0.85 + r() * 0.3);
    for (let ring = 1; ring <= 5; ring++) {
      const loop = seedLoop.map((k, i) => {
        const a = (i / 16) * Math.PI * 2;
        const s = ring / 5;
        return px([cx + Math.cos(a) * rx * k * s, cz + Math.sin(a) * rz * k * s]);
      });
      smooth(ctx, loop, true);
      ctx.stroke();
    }
  }

  // The Isère.
  smooth(ctx, map(ISERE), false);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.lagonClair;
  ctx.lineWidth = 0.62 * u;
  ctx.stroke();
  ctx.strokeStyle = C.ciel;
  ctx.lineWidth = 0.5 * u;
  ctx.stroke();

  // Lakes.
  for (const shore of [paladruShore, saugetShore]) {
    smooth(ctx, map(shore), true);
    ctx.fillStyle = C.lagon;
    ctx.fill();
    ctx.strokeStyle = C.encre;
    ctx.lineWidth = 0.05 * u;
    ctx.stroke();
  }

  // Roads: fine dashed ink.
  ctx.setLineDash([0.02 * u, 0.16 * u]);
  ctx.lineWidth = 0.055 * u;
  ctx.strokeStyle = 'rgba(11, 53, 64, 0.5)';
  const roads = [
    [[-11.2, 5.9], [-8.2, 5.2], [-6.4, 4.95], [-3.1, 4.72]],
    [[1.9, 3.3], [3.4, 3.4], [5.2, 4.78]],
    [[1.9, 3.3], [4.2, 2.3], [6.6, 1.5], [9.2, -0.4], [9.9, -1.5]],
    [[5.2, 4.78], [8.4, 5.9], [11.2, 5.6]],
  ];
  for (const road of roads) {
    smooth(ctx, map(road), false);
    ctx.stroke();
  }

  // Le chemin : the suggested way to the quieter spot.
  ctx.setLineDash([0.2 * u, 0.2 * u]);
  ctx.lineWidth = 0.1 * u;
  ctx.strokeStyle = C.corail;
  smooth(ctx, map(CHEMIN), false);
  ctx.stroke();
  ctx.setLineDash([]);
  const [ex, ez] = px(CHEMIN[CHEMIN.length - 1]);
  ctx.fillStyle = C.corail;
  ctx.strokeStyle = C.encre;
  ctx.lineWidth = 0.035 * u;
  ctx.beginPath();
  ctx.moveTo(ex + 0.32 * u, ez - 0.06 * u);
  ctx.lineTo(ex - 0.04 * u, ez - 0.22 * u);
  ctx.lineTo(ex + 0.02 * u, ez + 0.2 * u);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Parking bays at the foot of the Lauvitel.
  if (side > 0) {
    ctx.strokeStyle = 'rgba(11, 53, 64, 0.45)';
    ctx.lineWidth = 0.04 * u;
    for (const bx of [5.5, 6.05, 6.6, 9.7, 10.25, 10.8]) {
      const [a, b] = px([bx, -2.75]);
      ctx.beginPath();
      ctx.moveTo(a, b);
      ctx.lineTo(a, b + 0.9 * u);
      ctx.stroke();
    }
  }

  // Lettering.
  const label = (text, x, z, size, { colour = C.encre, weight = 600, align = 'center', font = TITLE, turn = 0, spacing = 0 } = {}) => {
    const [a, b] = px([x, z]);
    ctx.save();
    ctx.translate(a, b);
    ctx.rotate(turn);
    ctx.font = `${weight} ${size * u}px ${font}`;
    ctx.letterSpacing = `${spacing * u}px`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colour;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  label('Lac de Paladru', PALADRU.cx + 0.1, PALADRU.cz - 0.35, 0.5, { colour: C.creme, turn: -0.1 });
  label('Charavines', -5.0, 4.98, 0.3, { weight: 500 });
  label('Office de tourisme', -9.2, 6.45, 0.28, { weight: 500 });
  label('L’Isère', -7.6, -2.62, 0.3, { colour: C.lagonFonce, weight: 500, turn: 0.04 });
  label('Chartreuse', -5.4, -3.55, 0.4, { colour: C.saugeFonce, spacing: 0.06 });
  label('Étang du Sauget', SAUGET.cx, SAUGET.cz + 0.02, 0.3, { colour: C.creme, turn: 0.1 });
  label('Les Échelles', 9.0, 5.75, 0.28, { weight: 500 });
  label('Grenoble', 3.9, 3.9, 0.46, {});
  label('Fort de la Bastille', 3.3, 0.02, 0.28, { weight: 500 });
  label('L’Isère', 7.5, 0.62, 0.3, { colour: C.lagonFonce, weight: 500, turn: -0.42 });
  label('Lac du Lauvitel', 8.1, -1.35, 0.34, {});
  label('Les Deux Alpes', 8.1, -0.95, 0.26, { weight: 500 });
  label('17 km', 1.0, 4.72, 0.3, { colour: C.corailFonce, weight: 600 });

  // Legend: the four levels of the application.
  if (side > 0) {
    const names = [['calme', 'Calme'], ['modere', 'Modéré'], ['charge', 'Chargé'], ['sature', 'Saturé']];
    let lx = 5.2;
    for (const [id, name] of names) {
      const [a, b] = px([lx, 6.45]);
      ctx.beginPath();
      ctx.arc(a, b, 0.13 * u, 0, Math.PI * 2);
      ctx.fillStyle = LEVEL_COLOURS[id];
      ctx.fill();
      ctx.lineWidth = 0.035 * u;
      ctx.strokeStyle = C.encre;
      ctx.stroke();
      label(name, lx + 0.25, 6.46, 0.27, { align: 'left', weight: 600, font: TEXT });
      lx += 1.42;
    }
  }

  // The fold: pages darken as they dive into the gutter.
  const gx = side < 0 ? canvas.width : 0;
  const shade = ctx.createLinearGradient(gx, 0, gx + side * 1.5 * u, 0);
  shade.addColorStop(0, 'rgba(11, 53, 64, 0.26)');
  shade.addColorStop(0.35, 'rgba(11, 53, 64, 0.07)');
  shade.addColorStop(1, 'rgba(11, 53, 64, 0)');
  ctx.fillStyle = shade;
  ctx.fillRect(side < 0 ? canvas.width - 1.5 * u : 0, 0, 1.5 * u, canvas.height);

  return texture(canvas, renderer);
}

/** The front cover, seen for a moment before the book opens. */
export function coverPrint(renderer, mascot) {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE.w * 96;
  canvas.height = PAGE.d * 96;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = C.encre;
  ctx.fillRect(0, 0, W, H);
  const cy = H * 0.505, r = W * 0.26;
  ctx.fillStyle = C.soleil;
  ctx.beginPath();
  ctx.arc(W / 2, cy, r, 0, Math.PI * 2);
  ctx.fill();
  if (mascot) ctx.drawImage(mascot, W / 2 - r * 0.9, cy - r * 0.967, r * 1.8, r * 1.8);
  ctx.fillStyle = C.creme;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${W * 0.17}px ${TITLE}`;
  ctx.fillText('Plutôt là', W / 2, H * 0.17);
  ctx.font = `600 ${W * 0.058}px ${TEXT}`;
  ctx.fillStyle = C.lagonClair;
  ctx.fillText('L’Isère en livre animé', W / 2, H * 0.265);
  ctx.fillStyle = C.creme;
  ctx.font = `600 ${W * 0.062}px ${TITLE}`;
  ctx.fillText('C’est plein ? On vous trouve', W / 2, H * 0.77);
  ctx.fillText('un coin plus calme.', W / 2, H * 0.825);
  ctx.strokeStyle = C.lagon;
  ctx.lineWidth = W * 0.012;
  ctx.strokeRect(W * 0.05, W * 0.05, W * 0.9, H - W * 0.1);
  const t = texture(canvas, renderer);
  return t;
}

function roundRect(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/**
 * A partner's web page with the widget set into it, redrawn in that partner's
 * theme. The numbers are the widget's own demonstration day.
 */
export class WidgetPrint {
  constructor(renderer) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 900;
    this.canvas.height = 820;
    this.texture = texture(this.canvas, renderer);
  }

  draw(theme) {
    const ctx = this.canvas.getContext('2d');
    const W = this.canvas.width, H = this.canvas.height;
    const c = theme.colours;
    const serif = theme.serif ? 'Georgia, "Times New Roman", serif' : TEXT;
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Browser window.
    ctx.fillStyle = c.fond;
    roundRect(ctx, 0, 0, W, H, 34);
    ctx.fill();
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 34);
    ctx.clip();
    ctx.fillStyle = C.encre;
    ctx.fillRect(0, 0, W, 64);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = [C.corail, C.soleil, C.lagon][i];
      ctx.beginPath();
      ctx.arc(40 + i * 34, 32, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    // The partner's own header.
    ctx.fillStyle = c.primaire;
    ctx.fillRect(0, 64, W, 96);
    ctx.fillStyle = c.surPrimaire;
    ctx.font = `700 40px ${serif}`;
    ctx.fillText(theme.name, 40, 114);
    ctx.restore();

    // The widget card.
    const x = 40, y = 196, w = W - 80, h = H - y - 40;
    ctx.fillStyle = c.carte;
    roundRect(ctx, x, y, w, h, theme.radius * 2.4);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = c.contour;
    ctx.stroke();

    ctx.fillStyle = c.libelle;
    ctx.font = `600 26px ${TEXT}`;
    ctx.fillText('Le Lac de Paladru, Charavines', x + 34, y + 46);
    ctx.fillStyle = c.texte;
    ctx.font = `700 38px ${serif}`;
    ctx.fillText('Y aura-t-il du monde ?', x + 34, y + 96);

    ctx.fillStyle = c.sature;
    ctx.beginPath();
    ctx.arc(x + 58, y + 166, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.texte;
    ctx.font = `700 52px ${serif}`;
    ctx.fillText('Très fréquenté', x + 100, y + 168);
    ctx.fillStyle = c.description;
    ctx.font = `600 27px ${TEXT}`;
    ctx.fillText('Jusqu’à 18 h, plus calme à partir de 20 h', x + 34, y + 226);

    // The day's curve: thirteen hours, 8 h to 20 h.
    const levels = ['calme', 'calme', 'modere', 'modere', 'modere', 'modere', 'charge', 'sature', 'sature', 'sature', 'charge', 'charge', 'calme'];
    const heights = [0.14, 0.24, 0.5, 0.56, 0.44, 0.4, 0.62, 0.92, 0.84, 0.66, 0.42, 0.26, 0.12];
    const bw = (w - 68) / 13;
    const base = y + 400;
    ctx.fillStyle = c.surlignage;
    ctx.fillRect(x + 34 + 7 * bw - 6, base - 150, bw + 6, 156);
    levels.forEach((level, i) => {
      ctx.fillStyle = c[level];
      roundRect(ctx, x + 34 + i * bw + 7, base - heights[i] * 140, bw - 14, heights[i] * 140, 7);
      ctx.fill();
    });
    ctx.fillStyle = c.libelle;
    ctx.font = `600 22px ${TEXT}`;
    ctx.fillText('8 h', x + 34, base + 26);
    ctx.textAlign = 'right';
    ctx.fillText('20 h', x + w - 34, base + 26);
    ctx.textAlign = 'center';
    ctx.fillStyle = c.texte;
    ctx.fillText('15 h', x + 34 + 7.5 * bw, base + 26);

    // The action.
    const by = y + h - 108;
    ctx.fillStyle = c.primaire;
    roundRect(ctx, x + 34, by, w - 68, 74, Math.min(theme.button, 37));
    ctx.fill();
    ctx.fillStyle = c.surPrimaire;
    ctx.font = `700 30px ${TEXT}`;
    ctx.fillText('Trouver un coin plus calme', x + w / 2, by + 38);
    ctx.textAlign = 'left';

    this.texture.needsUpdate = true;
  }
}

/** Soft round sprite for dust, fireflies and glints. */
export function glowSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}
