import * as THREE from 'three';
import { C, Popup, paperGeometry, paperMaterial, sheetMesh, withPaper } from './paper.js';
import * as art from './scenery.js';
import { PX, rng } from './scenery.js';
import { PAGE, paladruShore, saugetShore } from './layout.js';
import { pagePrint, coverPrint, WidgetPrint } from './prints.js';

const BLOCK = 0.3; // thickness of each half of the page block
const BOARD = 0.1; // cover board

function flatShape(points) {
  const s = new THREE.Shape();
  points.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  return s;
}

function edgeStripes() {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#F4E8D0';
  ctx.fillRect(0, 0, 8, 64);
  ctx.fillStyle = 'rgba(11, 53, 64, 0.16)';
  for (let y = 2; y < 64; y += 4) ctx.fillRect(0, y, 8, 1);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildWorld({ renderer, svgs, mascot }) {
  const root = new THREE.Group();
  const popups = [];
  const tickers = [];
  const paper = paperMaterial();
  const sheet = (source, opts) => sheetMesh(paperGeometry(source, opts), paper);

  // ---- The table -----------------------------------------------------------
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    withPaper(new THREE.MeshStandardMaterial({ color: '#0A3B47', roughness: 0.9 }), { grain: 0.16 }),
  );
  table.rotation.x = -Math.PI / 2;
  table.position.y = -(BLOCK + BOARD) - 0.012;
  table.receiveShadow = true;
  root.add(table);

  // Offcuts left on the table by whoever cut the book out.
  {
    const r = rng(77);
    const shapes = [new THREE.CircleGeometry(0.11, 14), new THREE.CircleGeometry(0.13, 3), new THREE.PlaneGeometry(0.2, 0.1)];
    const colours = [C.soleil, C.lagon, C.corail, C.sauge, C.creme, C.sapin];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const material = withPaper(new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.DoubleSide }));
    shapes.forEach((geometry, gi) => {
      const mesh = new THREE.InstancedMesh(geometry, material, 26);
      for (let i = 0; i < 26; i++) {
        const side = r() < 0.5;
        const x = side ? (r() < 0.5 ? -1 : 1) * (12.2 + r() * 5) : (r() - 0.5) * 30;
        const z = side ? (r() - 0.5) * 20 : (r() < 0.72 ? 1 : -1) * (8 + r() * 3.6);
        p.set(x, table.position.y + 0.006 + r() * 0.004, z);
        e.set(-Math.PI / 2 + (r() - 0.5) * 0.12, 0, r() * 6.28);
        s.setScalar(0.7 + r() * 0.9);
        mesh.setMatrixAt(i, m.compose(p, q.setFromEuler(e), s));
        mesh.setColorAt(i, new THREE.Color(colours[Math.floor(r() * colours.length + gi) % colours.length]));
      }
      mesh.receiveShadow = true;
      root.add(mesh);
    });
  }

  // ---- The book ------------------------------------------------------------
  const left = new THREE.Group();
  const right = new THREE.Group();
  root.add(left, right);
  const stripes = edgeStripes();
  const blockMat = withPaper(new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.96 }));
  const boardMat = new THREE.MeshStandardMaterial({ color: C.encre, roughness: 0.62 });

  for (const [group, side] of [[left, -1], [right, 1]]) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(PAGE.w, BLOCK, PAGE.d), blockMat);
    block.position.set((side * PAGE.w) / 2, -BLOCK / 2, 0);
    block.castShadow = block.receiveShadow = true;
    const board = new THREE.Mesh(new THREE.BoxGeometry(PAGE.w + 0.3, BOARD, PAGE.d + 0.5), boardMat);
    board.position.set(side * (PAGE.w / 2 + 0.1), -BLOCK - BOARD / 2, 0);
    board.castShadow = board.receiveShadow = true;
    const page = new THREE.Mesh(
      new THREE.PlaneGeometry(PAGE.w, PAGE.d),
      withPaper(new THREE.MeshStandardMaterial({ map: pagePrint(side, renderer), roughness: 0.95 }), { grain: 0.07 }),
    );
    page.rotation.x = -Math.PI / 2;
    page.position.set((side * PAGE.w) / 2, 0.002, 0);
    page.receiveShadow = true;
    group.add(block, board, page);
  }

  const spine = new THREE.Group();
  const spineBox = new THREE.Mesh(new THREE.BoxGeometry(0.8, BLOCK + BOARD + 0.02, PAGE.d + 0.5), boardMat);
  spineBox.position.y = -(BLOCK + BOARD + 0.02) / 2 - 0.004;
  spineBox.castShadow = true;
  spine.add(spineBox);
  root.add(spine);

  const coverTex = coverPrint(renderer, mascot);
  coverTex.center.set(0.5, 0.5);
  coverTex.rotation = Math.PI;
  const cover = new THREE.Mesh(new THREE.PlaneGeometry(PAGE.w, PAGE.d), new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.6 }));
  cover.rotation.x = Math.PI / 2;
  cover.position.set(-PAGE.w / 2 - 0.1, -BLOCK - BOARD - 0.003, 0);
  left.add(cover);

  // ---- Pop-ups -------------------------------------------------------------
  const jitter = rng(5);
  const popup = (group, x, z, opts = {}) => {
    const p = new Popup({ x, z, delay: (z + 7) * 0.075 + jitter() * 0.12, ...opts });
    group.add(p.root);
    popups.push(p);
    return p;
  };
  const stand = (group, source, x, z, geoOpts, popOpts) => {
    const p = popup(group, x, z, popOpts);
    p.sheet = p.add(sheet(source, geoOpts));
    return p;
  };

  // Chartreuse, on the left page.
  stand(left, art.ridge({ w: 1060, h: 520, peaks: 5, seed: 14, fill: C.lagonClair, shade: C.sapinClair, snow: 0.3 }), -5.6, -6.35, { scale: PX }, { fold: 1, lean: 0.03 });
  stand(left, art.ridge({ w: 1040, h: 380, peaks: 6, seed: 4, fill: C.lagon, shade: C.sapin, snow: 0.22, snowFrom: 0.86 }), -5.6, -5.3, { scale: PX }, { fold: 1, lean: 0.05 });
  stand(left, art.hills({ w: 1010, h: 200, bumps: 5, seed: 9, fill: C.sauge, shade: '#8DB583' }), -5.65, -4.2, { scale: PX }, { fold: 1 });

  // Belledonne and the Oisans, on the right page.
  stand(right, art.ridge({ w: 1060, h: 640, peaks: 5, seed: 23, fill: C.sapinClair, shade: '#6FA5A1', snow: 0.36, snowFrom: 0.55 }), 5.6, -6.35, { scale: PX }, { fold: 1, lean: 0.03 });
  stand(right, art.ridge({ w: 1030, h: 440, peaks: 5, seed: 31, fill: C.lagon, shade: C.sapin, snow: 0.26, snowFrom: 0.8 }), 5.65, -5.35, { scale: PX }, { fold: 1, lean: 0.05 });

  // Forest.
  const firs = [
    [left, -9.9, -3.3, 1.7], [left, -9.0, -3.65, 1.35], [left, -8.2, -3.2, 1.1], [left, -2.4, -3.5, 1.5], [left, -1.5, -3.15, 1.15],
    [left, -1.0, -2.2, 0.95], [left, -10.1, -1.0, 1.25], [left, -9.7, 0.4, 1.0], [left, -10.2, 1.7, 1.3], [left, -1.25, -0.5, 1.0], [left, -4.4, -3.4, 0.9],
    [right, 0.95, -2.7, 1.3], [right, 1.6, -3.5, 1.6], [right, 0.8, -1.4, 0.95], [right, 5.6, -4.4, 1.2], [right, 10.5, -4.35, 1.4], [right, 6.3, 0.1, 1.0],
    [right, 10.3, 0.9, 1.3], [right, 9.5, 0.3, 0.95], [right, 10.6, -0.3, 1.1], [right, 4.4, -4.3, 1.05],
  ];
  const firGeo = [C.sapinFonce, C.sapin, C.lagonFonce].map((fill, i) => paperGeometry(art.fir(fill, 3 + (i % 2)), { height: 1, detail: 4 }));
  firs.forEach(([group, x, z, h], i) => {
    const p = popup(group, x, z, { turn: (jitter() - 0.5) * 0.3 });
    const m = p.add(sheetMesh(firGeo[i % 3], paper));
    m.scale.setScalar(h);
  });

  // Clouds on card arms behind the ranges.
  const clouds = [[left, -7.7, 6.3, 2.5], [left, -2.9, 7.0, 1.9], [right, 3.9, 7.7, 2.3], [right, 9.5, 7.1, 1.7]];
  const cloudGeo = paperGeometry(art.cloud(), { height: 1 });
  clouds.forEach(([group, x, y, w], i) => {
    const p = popup(group, x, -6.75, { fold: 1, lean: 0 });
    p.add(sheet(art.strip(14, Math.round(y * 100)), { scale: PX, detail: 4 }));
    const c = p.add(sheetMesh(cloudGeo, paper), 0, y - 0.3, 0.03);
    c.scale.setScalar(w / 2);
    tickers.push((t) => {
      p.hinge.rotation.z = Math.sin(t * 0.35 + i * 1.7) * 0.012;
      c.position.x = Math.sin(t * 0.22 + i * 2.3) * 0.12;
    });
  });

  // Lac de Paladru: three rows of paper sea, a boat between them.
  const waves = [[-5.75, -0.25, 520, 3], [-5.6, 0.75, 610, 4], [-5.85, 1.75, 500, 5]].map(([x, z, w, seed], i) => {
    const p = stand(left, art.waves({ w, seed, fill: i === 1 ? C.lagon : C.sapin }), x, z, { scale: PX }, { lean: 0.02 });
    tickers.push((t) => {
      p.sheet.position.x = Math.sin(t * 0.9 + i * 2.1) * 0.16;
      p.sheet.position.y = Math.sin(t * 1.3 + i * 1.3) * 0.025 - 0.02;
    });
    return p;
  });
  const boat = stand(left, svgs['envie-sur-l-eau'], -6.7, 1.25, { height: 1.05, sticker: 4 }, { lean: 0.03 });
  tickers.push((t) => {
    boat.sheet.rotation.z = Math.sin(t * 1.1) * 0.05;
    boat.sheet.position.y = Math.sin(t * 1.3 + 1) * 0.04;
    boat.sheet.position.x = Math.sin(t * 0.25) * 0.5;
  });
  stand(left, art.pontoon(), -3.75, 2.35, { scale: 0.0058 }, { turn: -0.12 });

  // The tourist office and the web page that carries the widget.
  const kioskGeo = paperGeometry(art.kiosk(), { scale: 0.0086 });
  const kiosk = popup(left, -9.6, 3.9, { turn: 0.16 });
  kiosk.add(sheetMesh(kioskGeo, paper));
  const awningMat = withPaper(new THREE.MeshStandardMaterial({ color: C.sapin, roughness: 0.9, side: THREE.DoubleSide }));
  const awningGeo = paperGeometry(art.awning('#FFFFFF'), { scale: 0.0086 });
  const [ax, ay] = kioskGeo.userData.at(130, 176);
  const awning = kiosk.add(sheetMesh(awningGeo, awningMat), ax, ay, 0.05);
  awning.rotation.x = 0.5;

  const widget = new WidgetPrint(renderer);
  const board = popup(left, -8.45, 5.75, { turn: 0.26, lean: 0.1 });
  const boardW = 2.75, boardH = (boardW * 820) / 900;
  const back = new THREE.Shape();
  {
    const w = boardW + 0.12, h = boardH + 0.12, r = 0.16;
    back.moveTo(-w / 2 + r, 0);
    back.lineTo(w / 2 - r, 0);
    back.absarc(w / 2 - r, r, r, -Math.PI / 2, 0);
    back.lineTo(w / 2, h - r);
    back.absarc(w / 2 - r, h - r, r, 0, Math.PI / 2);
    back.lineTo(-w / 2 + r, h);
    back.absarc(-w / 2 + r, h - r, r, Math.PI / 2, Math.PI);
    back.lineTo(-w / 2, r);
    back.absarc(-w / 2 + r, r, r, Math.PI, Math.PI * 1.5);
  }
  const backing = new THREE.Mesh(new THREE.ShapeGeometry(back, 8), withPaper(new THREE.MeshStandardMaterial({ color: C.encre, roughness: 0.9, side: THREE.DoubleSide })));
  backing.castShadow = backing.receiveShadow = true;
  board.add(backing, 0, 0.42, 0);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(boardW, boardH),
    withPaper(new THREE.MeshStandardMaterial({ map: widget.texture, roughness: 0.8, alphaTest: 0.5 }), { grain: 0.04 }),
  );
  screen.receiveShadow = true;
  board.add(screen, 0, 0.42 + 0.06 + boardH / 2, 0.012);
  for (const lx of [-0.85, 0.85]) board.add(sheet(art.strip(16, 60, C.encre), { scale: PX, detail: 4 }), lx, 0, -0.01);

  // Grenoble: the Bastille on its hill, the cable car across the Isère.
  const hillGeo = paperGeometry(art.fortHill(), { scale: PX });
  const hill = popup(right, 3.2, -0.9, { fold: 1 });
  hill.add(sheetMesh(hillGeo, paper));
  const [fx, fy] = hillGeo.userData.at(238, 52);
  hill.add(sheet(svgs['site-patrimoine'], { height: 1.55 }), fx, fy - 0.22, 0.06);
  const fortTop = new THREE.Vector3(3.2 + fx - 0.75, fy + 0.55, -0.9 + 0.1);

  const stationGeo = paperGeometry(art.station(), { scale: 0.0078 });
  const station = popup(right, 1.95, 2.55, { turn: 0.1 });
  station.add(sheetMesh(stationGeo, paper));
  const town = art.houses(3);
  stand(right, town, 4.75, 2.6, { scale: 0.0082 }, { turn: -0.08 });
  stand(right, art.houses(12), 3.5, 1.95, { scale: 0.0068 }, { turn: 0.05 });
  stand(right, svgs['mode-transport'], 3.15, 3.3, { height: 0.82, sticker: 4 }, { turn: 0.06 });

  // Lac du Lauvitel: a lake on a rock shelf, a car park at its foot.
  const lauvitel = [];
  lauvitel.push(stand(right, art.lauvitelShelf(), 8.05, -3.6, { scale: PX }, { fold: 1, lean: 0.05, keep: true }));
  lauvitel.push(stand(right, svgs['mode-voiture'], 6.05, -2.3, { height: 0.72, sticker: 4 }, { turn: 0.1 }));
  lauvitel.push(stand(right, svgs['mode-voiture'], 10.25, -2.35, { height: 0.72, sticker: 4 }, { turn: -0.1 }));
  lauvitel.push(stand(right, art.parkingSign(), 10.6, -1.7, { height: 1.25 }));
  const sign = stand(right, art.fullSign(), 9.85, -3.2, { height: 2.3, sticker: 5 }, { lean: 0.1 });
  sign.manual = true;

  // Étang du Sauget: reeds, trees, a bench with room on it.
  stand(right, art.hills({ w: 480, h: 110, bumps: 3, seed: 2, fill: C.saugeClair, shade: C.sauge }), 8.0, 1.75, { scale: PX }, { fold: 1 });
  [[6.3, 2.3, 1.7], [9.5, 2.55, 2.0], [10.3, 3.7, 1.5]].forEach(([x, z, h], i) => stand(right, art.leafTree(i === 1 ? C.sauge : '#8DB583'), x, z, { height: h }, { turn: (i - 1) * 0.12 }));
  [[5.75, 3.95, 7], [8.95, 4.15, 3], [9.15, 3.1, 5]].forEach(([x, z, seed]) => stand(right, art.reeds(seed), x, z, { height: 0.95 }));
  stand(right, svgs['affluence-banc-calme'], 5.5, 2.95, { height: 0.95, sticker: 4 }, { turn: 0.2 });

  // The four Éclaireurs, at the front of the stage.
  const heroes = {};
  [['chapeau', left, -3.35, 1.5], ['canne', left, -1.5, 1.6], ['fauteuil', right, 1.6, 1.78], ['chien', right, 3.5, 1.5]].forEach(([id, group, x, h], i) => {
    const p = stand(group, svgs[`eclaireur-${id}`], x, 6.0, { height: h, sticker: 6, detail: 14 }, { lean: 0.09, turn: (1.5 - i) * 0.07 });
    heroes[id] = p;
    p.hop = 0;
    tickers.push((t, dt) => {
      p.hop = Math.max(0, p.hop - dt * 1.4);
      const k = p.hop;
      p.sheet.position.y = Math.abs(Math.sin(k * Math.PI * 3)) * 0.42 * k;
      p.sheet.rotation.z = Math.sin(t * 1.5 + i * 1.9) * 0.03 + Math.sin(k * Math.PI * 6) * 0.08 * k;
    });
  });

  // ---- Things that straddle the gutter, set up once the book lies open -----
  const loose = new THREE.Group();
  root.add(loose);

  // The glossy lake surfaces, laid over the printed water.
  const waterMat = new THREE.MeshPhysicalMaterial({ color: C.lagon, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.28, transparent: true, opacity: 0.45 });
  for (const [group, shore] of [[left, paladruShore], [right, saugetShore]]) {
    const water = new THREE.Mesh(new THREE.ShapeGeometry(flatShape(shore), 4), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.012;
    water.receiveShadow = true;
    group.add(water);
  }

  // The sun, on an arm that swings with the hour.
  const sunArm = new THREE.Group();
  sunArm.position.set(0.1, 0, -6.95);
  const armLength = 7.7;
  sunArm.add(sheet(art.strip(16, armLength * 100), { scale: PX, detail: 4 }));
  const sunMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const sun = new THREE.Mesh(paperGeometry(svgs['meteo-soleil'], { height: 2.3, sticker: 5 }), sunMat);
  sun.position.set(0, armLength - 1.1, 0.03);
  sunArm.add(sun);
  loose.add(sunArm);

  // The cable and its bubbles.
  const stationTop = new THREE.Vector3(1.95, 1.42, 2.6);
  const cableMat = new THREE.MeshStandardMaterial({ color: C.encre, roughness: 0.7 });
  const span = fortTop.clone().sub(stationTop);
  const cables = [-0.07, 0.07].map((dx) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, span.length(), 5), cableMat);
    c.position.copy(stationTop).addScaledVector(span, 0.5);
    c.position.x += dx;
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.clone().normalize());
    c.castShadow = true;
    loose.add(c);
    return c;
  });
  const bubbleGeo = paperGeometry(art.bubble(), { height: 0.5 });
  const trains = [0, 1].map((k) => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const b = sheetMesh(bubbleGeo, paper);
      b.position.set(0, -0.5, 0);
      const holder = new THREE.Group();
      holder.add(b);
      holder.userData.offset = (i - 1) * 0.085;
      g.add(holder);
    }
    loose.add(g);
    return g;
  });
  tickers.push((t) => {
    trains.forEach((g, k) => {
      const cycle = (t * 0.045 + k * 0.5) % 1;
      const u = 0.5 - 0.5 * Math.cos(Math.min(1, cycle / 0.42) * Math.PI) - (0.5 - 0.5 * Math.cos(Math.min(1, Math.max(0, cycle - 0.5) / 0.42) * Math.PI));
      g.children.forEach((holder, i) => {
        const v = THREE.MathUtils.clamp(0.1 + u * 0.8 + holder.userData.offset, 0.02, 0.98);
        holder.position.copy(stationTop).addScaledVector(span, v);
        holder.position.x += k ? 0.07 : -0.07;
        holder.rotation.z = Math.sin(t * 2.2 + i + k * 3) * 0.06;
      });
    });
  });

  // Windows that light up at dusk.
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.soleil).multiplyScalar(2.6), transparent: true, opacity: 0, depthWrite: false });
  const lit = (p, geo, sx, sy, w, h, k) => {
    const [x, y] = geo.userData.at(sx + w / 2, sy + h / 2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * k * 0.82, h * k * 0.8), glowMat);
    p.add(m, x, y, 0.03);
  };
  lit(kiosk, kioskGeo, 44, 176, 84, 56, 0.0086);
  lit(station, stationGeo, 28, 100, 28, 34, 0.0078);
  lit(station, stationGeo, 174, 100, 28, 34, 0.0078);

  // ---- Opening -------------------------------------------------------------
  let opened = 0;
  const setCover = (v) => {
    opened = v;
    left.rotation.z = -Math.PI * (1 - v);
    spine.rotation.z = (-Math.PI / 2) * (1 - v);
    loose.visible = v > 0.999;
  };
  setCover(0);

  let looseScale = 0;
  const setLoose = (v) => {
    looseScale = v;
    sunArm.scale.setScalar(Math.max(0.0001, v));
    const s = Math.max(0.0001, v);
    cables.forEach((c) => c.scale.set(1, s, 1));
    trains.forEach((g) => (g.visible = v > 0.6));
  };
  setLoose(0);

  return {
    root, left, right, loose, popups, heroes, lauvitel, sign, board, kiosk, widget, awningMat, glowMat, sunArm, sun, waterMat, waves,
    setCover, setLoose,
    get opened() { return opened; },
    get looseScale() { return looseScale; },
    update(t, dt) {
      for (const p of popups) p.update(dt);
      for (const tick of tickers) tick(t, dt);
    },
  };
}
