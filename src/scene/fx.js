import * as THREE from 'three';
import { C, withPaper } from './paper.js';
import { glowSprite } from './prints.js';
import { PALADRU, SAUGET } from './layout.js';
import { rng } from './scenery.js';

function motes({ count, place, motion, size, sprite }) {
  const r = rng(count * 7 + 3);
  const position = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const p = place(r);
    position.set(p, i * 3);
    seed.set([r(), r(), r(), r()], i * 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(1, 1, 1) },
      uAmount: { value: 1 },
      uSize: { value: size },
      uScale: { value: 1 },
      uMap: { value: sprite },
    },
    vertexShader: `
      attribute vec4 aSeed;
      uniform float uTime, uSize, uScale, uAmount;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float a = 1.0;
        float k = 1.0;
        ${motion}
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * k * uScale / -mv.z;
        vAlpha = a * uAmount;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform sampler2D uMap;
      varying float vAlpha;
      void main() {
        float s = texture2D(uMap, gl_PointCoord).a * vAlpha;
        gl_FragColor = vec4(uColor * s, s);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

/** Atmosphere: dust in the light, glints on the water, fireflies at dusk, confetti when paper snaps up. */
export function buildFx(scene) {
  const sprite = glowSprite();

  const dust = motes({
    count: 420,
    sprite,
    size: 30,
    place: (r) => [(r() - 0.5) * 34, 0.4 + r() * 11, (r() - 0.5) * 24 + 1],
    motion: `
      p.x += sin(uTime * (0.05 + aSeed.x * 0.08) + aSeed.y * 6.28) * 1.4;
      p.y += sin(uTime * (0.04 + aSeed.z * 0.07) + aSeed.w * 6.28) * 0.9;
      p.z += cos(uTime * (0.04 + aSeed.y * 0.06) + aSeed.x * 6.28) * 1.2;
      k = 0.35 + aSeed.w * 1.1;
      a = (0.25 + 0.75 * aSeed.z) * (0.6 + 0.4 * sin(uTime * (0.4 + aSeed.x) + aSeed.w * 30.0));`,
  });

  const inLake = (lake, r) => {
    const a = r() * 6.28, d = Math.sqrt(r()) * 0.9;
    return [lake.cx + Math.cos(a) * lake.rx * d, 0.03 + r() * 0.3, lake.cz + Math.sin(a) * lake.rz * d];
  };
  const glints = motes({
    count: 110,
    sprite,
    size: 9,
    place: (r) => inLake(r() < 0.78 ? PALADRU : SAUGET, r),
    motion: `
      float tw = sin(uTime * (1.2 + aSeed.x * 2.4) + aSeed.y * 40.0);
      a = pow(max(tw, 0.0), 9.0);
      k = 0.5 + aSeed.z;`,
  });

  const fireflies = motes({
    count: 90,
    sprite,
    size: 62,
    place: (r) => {
      const spot = r();
      if (spot < 0.5) return [SAUGET.cx + (r() - 0.5) * 6, 0.25 + r() * 1.6, SAUGET.cz + (r() - 0.5) * 3.4];
      if (spot < 0.8) return [-5.5 + (r() - 0.5) * 8, 0.3 + r() * 1.3, 3.8 + (r() - 0.5) * 2];
      return [(r() - 0.5) * 18, 0.4 + r() * 2.2, -3 + (r() - 0.5) * 3];
    },
    motion: `
      p.x += sin(uTime * (0.35 + aSeed.x * 0.5) + aSeed.y * 6.28) * 0.5;
      p.y += sin(uTime * (0.5 + aSeed.z * 0.6) + aSeed.w * 6.28) * 0.22;
      p.z += cos(uTime * (0.3 + aSeed.w * 0.5) + aSeed.x * 6.28) * 0.4;
      a = smoothstep(0.1, 0.9, sin(uTime * (0.7 + aSeed.y * 1.3) + aSeed.z * 30.0) * 0.5 + 0.5);
      k = 0.6 + aSeed.x * 0.8;`,
  });
  fireflies.material.uniforms.uColor.value.set(C.soleil).multiplyScalar(3.2);
  glints.material.uniforms.uColor.value.setRGB(1.6, 1.6, 1.45);
  scene.add(dust, glints, fireflies);

  // Confetti: little paper offcuts thrown up when something pops.
  const MAX = 260;
  const confetti = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.11, 0.07),
    withPaper(new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide })),
    MAX,
  );
  confetti.castShadow = true;
  confetti.frustumCulled = false;
  const bits = Array.from({ length: MAX }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), floor: 0 }));
  const palette = [C.soleil, C.lagon, C.corail, C.sauge, C.papier, C.sapin].map((c) => new THREE.Color(c));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MAX; i++) {
    confetti.setMatrixAt(i, hidden);
    confetti.setColorAt(i, palette[i % palette.length]);
  }
  scene.add(confetti);
  let cursor = 0;
  const rnd = rng(9);

  return {
    dust, glints, fireflies,
    burst(at, count = 26, power = 1, floor = 0.01) {
      for (let i = 0; i < count; i++) {
        const b = bits[cursor];
        cursor = (cursor + 1) % MAX;
        b.life = 1.6 + rnd() * 1.6;
        b.floor = floor;
        b.p.set(at.x + (rnd() - 0.5) * 0.5, at.y + rnd() * 0.3, at.z + (rnd() - 0.5) * 0.5);
        const a = rnd() * 6.28;
        b.v.set(Math.cos(a) * (0.6 + rnd() * 1.8) * power, (2.6 + rnd() * 3.2) * power, Math.sin(a) * (0.6 + rnd() * 1.8) * power);
        b.r.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28);
        b.w.set((rnd() - 0.5) * 14, (rnd() - 0.5) * 14, (rnd() - 0.5) * 14);
      }
    },
    resize(height, pixelRatio) {
      const scale = height * pixelRatio * 0.9;
      for (const p of [dust, glints, fireflies]) p.material.uniforms.uScale.value = scale / 900;
    },
    update(t, dt, { day, dusk, sunColor }) {
      dust.material.uniforms.uTime.value = t;
      glints.material.uniforms.uTime.value = t;
      fireflies.material.uniforms.uTime.value = t;
      dust.material.uniforms.uColor.value.copy(sunColor).multiplyScalar(0.34);
      glints.material.uniforms.uAmount.value = 0.25 + 0.75 * day;
      fireflies.material.uniforms.uAmount.value = dusk;
      let dirty = false;
      for (let i = 0; i < MAX; i++) {
        const b = bits[i];
        if (b.life <= 0) continue;
        dirty = true;
        b.life -= dt;
        if (b.p.y > b.floor) {
          b.v.y -= 9.5 * dt;
          b.v.multiplyScalar(1 - 1.6 * dt);
          b.p.addScaledVector(b.v, dt);
          b.r.x += b.w.x * dt;
          b.r.y += b.w.y * dt;
          b.r.z += b.w.z * dt;
          if (b.p.y <= b.floor) {
            b.p.y = b.floor;
            b.r.x = -Math.PI / 2;
            b.r.y = 0;
          }
        }
        const k = b.life <= 0 ? 0 : Math.min(1, b.life / 0.4);
        confetti.setMatrixAt(i, m.compose(b.p, q.setFromEuler(b.r), s.setScalar(k)));
      }
      if (dirty) confetti.instanceMatrix.needsUpdate = true;
    },
  };
}
