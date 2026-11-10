import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

export const C = {
  encre: '#0B3540',
  encreHaute: '#1A434F',
  creme: '#FEF4E1',
  papier: '#FFFCF5',
  sable: '#FEEED0',
  soleil: '#FFC941',
  soleilClair: '#FFE19E',
  lagon: '#2BB0AD',
  lagonClair: '#9AD3CD',
  lagonFonce: '#036D6B',
  sapin: '#198B8A',
  sapinClair: '#8EBDB9',
  sapinFonce: '#025959',
  corail: '#FD795B',
  corailClair: '#FFB6A1',
  corailFonce: '#A53E26',
  sauge: '#A7C99B',
  saugeClair: '#CEE0C3',
  saugeFonce: '#5E7955',
  rouge: '#E01E1E',
  ciel: '#CDEBE6',
  nuit: '#02222B',
  nuitProfonde: '#01171E',
};

const loader = new SVGLoader();
const tint = new THREE.Color();

// Shared by every sheet of paper: the sun's direction and colour, so a sheet
// lit from behind lets a little light through.
export const paperUniforms = {
  uSunDirView: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color(1, 1, 1) },
  uBack: { value: 0.3 },
};

export function withPaper(material, { grain = 0.085 } = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, paperUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPaperPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaperPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vPaperPos;
        uniform vec3 uSunDirView;
        uniform vec3 uSunColor;
        uniform float uBack;
        float paperHash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float paperNoise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(paperHash(i), paperHash(i + vec3(1, 0, 0)), f.x), mix(paperHash(i + vec3(0, 1, 0)), paperHash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(paperHash(i + vec3(0, 0, 1)), paperHash(i + vec3(1, 0, 1)), f.x), mix(paperHash(i + vec3(0, 1, 1)), paperHash(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float fibre = paperNoise(vPaperPos * vec3(46.0, 46.0, 46.0)) * 0.55 + paperNoise(vPaperPos * 11.0) * 0.45;
        diffuseColor.rgb *= ${(1 - grain / 2).toFixed(4)} + ${grain.toFixed(4)} * fibre;`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        float through = max(dot(-normal, uSunDirView), 0.0);
        reflectedLight.directDiffuse += diffuseColor.rgb * uSunColor * through * uBack * RECIPROCAL_PI;`,
      );
  };
  return material;
}

let sheet;
export function paperMaterial() {
  sheet ??= withPaper(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0, side: THREE.DoubleSide }),
  );
  return sheet;
}

export function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/**
 * Turns an SVG drawing into one mesh geometry of stacked paper layers: each
 * element is its own sheet, a hair above the one before it. `sticker` adds the
 * cream die-cut margin the Éclaireurs carry in the brand's own artwork.
 */
export function paperGeometry(source, { height, scale, sticker = 0, gap = 0.004, detail = 10 } = {}) {
  const data = loader.parse(source);
  const pos = [];
  const col = [];

  const add = (geo, colour, z) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position.array;
    tint.setStyle(colour);
    for (let i = 0; i < p.length; i += 9) {
      const ax = p[i], ay = -p[i + 1], bx = p[i + 3], by = -p[i + 4], cx = p[i + 6], cy = -p[i + 7];
      const ccw = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax) > 0;
      if (ccw) pos.push(ax, ay, z, bx, by, z, cx, cy, z);
      else pos.push(ax, ay, z, cx, cy, z, bx, by, z);
      for (let k = 0; k < 3; k++) col.push(tint.r, tint.g, tint.b);
    }
    geo.dispose();
    if (g !== geo) g.dispose();
  };

  const stroke = (path, width, colour, z) => {
    const style = { ...path.userData.style, strokeWidth: width };
    for (const sub of path.subPaths) {
      const pts = sub.getPoints(detail);
      if (pts.length < 2) continue;
      const g = SVGLoader.pointsToStroke(pts, style, detail, 0.001);
      if (g) add(g, colour, z);
    }
  };

  const painted = (v) => v !== undefined && v !== 'none' && v !== 'transparent';

  if (sticker) {
    for (const path of data.paths) {
      const st = path.userData.style;
      if (painted(st.fill)) for (const s of path.toShapes()) add(new THREE.ShapeGeometry(s, detail), C.papier, 0);
      stroke(path, (painted(st.stroke) ? st.strokeWidth : 0) + sticker * 2, C.papier, 0);
    }
  }

  let z = sticker ? gap : 0;
  for (const path of data.paths) {
    const st = path.userData.style;
    if (painted(st.fill)) for (const s of path.toShapes()) add(new THREE.ShapeGeometry(s, detail), st.fill, z);
    if (painted(st.stroke) && st.strokeWidth > 0) stroke(path, st.strokeWidth, st.stroke, z + gap * 0.5);
    z += gap;
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    if (pos[i] < minX) minX = pos[i];
    if (pos[i] > maxX) maxX = pos[i];
    if (pos[i + 1] < minY) minY = pos[i + 1];
    if (pos[i + 1] > maxY) maxY = pos[i + 1];
  }
  const k = scale ?? height / (maxY - minY);
  const midX = (minX + maxX) / 2;
  const normal = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = (pos[i] - midX) * k;
    pos[i + 1] = (pos[i + 1] - minY) * k;
    normal[i + 2] = 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.computeBoundingSphere();
  geometry.userData = {
    width: (maxX - minX) * k,
    height: (maxY - minY) * k,
    depth: z,
    // SVG coordinates -> local sheet coordinates.
    at: (sx, sy) => [(sx - midX) * k, (-sy - minY) * k],
  };
  return geometry;
}

export function sheetMesh(geometry, material = paperMaterial()) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * A pop-up: sheets glued to one hinge on the page. `open` goes from 0 (lying
 * flat in the closed book) to 1 (standing), driven by a spring so it overshoots
 * the way stiff paper does.
 */
export class Popup {
  constructor({ x = 0, y = 0, z = 0, turn = 0, lean = 0.07, fold = -1, delay = 0, keep = false } = {}) {
    this.root = new THREE.Group();
    this.root.position.set(x, y, z);
    this.root.rotation.y = turn;
    this.hinge = new THREE.Group();
    this.root.add(this.hinge);
    this.lean = lean;
    this.fold = fold;
    this.delay = delay;
    // A sheet that stays in sight when it lies flat, like a closed pop-up.
    this.keep = keep;
    this.value = 0;
    this.speed = 0;
    this.target = 0;
    this.apply();
  }

  add(object, x = 0, y = 0, z = 0) {
    object.position.set(x, y, z);
    this.hinge.add(object);
    return object;
  }

  apply() {
    // The spring may overshoot upright, never through the page.
    const v = Math.max(0, this.value);
    this.hinge.rotation.x = this.fold * (Math.PI / 2) * (1 - v) - this.lean * v;
    // Flat sheets would fight the page for the same depth; keep them just above it.
    this.hinge.position.y = 0.012 * (1 - Math.min(1, v));
    this.hinge.visible = this.keep || v > 0.012;
  }

  set(v) {
    this.value = this.target = v;
    this.speed = 0;
    this.apply();
  }

  update(dt) {
    const d = this.target - this.value;
    if (Math.abs(d) < 0.0004 && Math.abs(this.speed) < 0.0004) {
      if (this.value !== this.target) {
        this.value = this.target;
        this.apply();
      }
      return;
    }
    this.speed += (d * 120 - this.speed * 13) * dt;
    this.value += this.speed * dt;
    this.apply();
  }
}
