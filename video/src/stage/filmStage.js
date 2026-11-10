import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { paperUniforms } from '../../../src/scene/paper.js';
import { buildWorld } from '../../../src/scene/world.js';
import { buildFx } from '../../../src/scene/fx.js';
import { Crowd } from '../../../src/scene/crowd.js';
import { Lens } from '../../../src/scene/post.js';
import { rng } from '../../../src/scene/scenery.js';
import { LEVELS, PARTNERS, countToLevel, levelAt } from '../../../src/data.js';
import { DURATION, EVENTS, FPS, HEROES, POINTS, SUBSTEPS, T, WORDS, cameraAt, clamp01, coverAt, foldDelay, hourAt, looseAt } from '../script.js';
import { Shutter } from './shutter.js';

const FOV = 30;
const RAD = Math.PI / 180;
const DT = 1 / (FPS * SUBSTEPS);
// The exposure lasts half the frame, as behind a 180° shutter.
const SHUTTER = 0.5 / FPS;
const MAX_EXPOSURES = 20;
const MARKS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];

// The light through the day, as in the presentation (src/scene/stage.js).
const SKY = [
  { h: 8, sun: '#FFD2A6', power: 1.9, sky: '#BFE1EC', ground: '#E8D2B0', fill: 0.7, back: '#04222B' },
  { h: 11, sun: '#FFF1DC', power: 2.3, sky: '#D4EFF1', ground: '#F0E2C4', fill: 0.85, back: '#062A33' },
  { h: 15, sun: '#FFF3DE', power: 2.35, sky: '#D4EFF1', ground: '#F0E2C4', fill: 0.85, back: '#062A33' },
  { h: 18, sun: '#FFC27A', power: 2.5, sky: '#C9DEDA', ground: '#F0CFA0', fill: 0.7, back: '#04222B' },
  { h: 20, sun: '#FFA35C', power: 3.0, sky: '#9DBDC2', ground: '#EDB98A', fill: 0.66, back: '#021C24' },
];

const SVGS = [
  ...['chapeau', 'canne', 'fauteuil', 'chien'].flatMap((c) => ['', '-surpris', '-fatigue'].map((m) => `eclaireur-${c}${m}`)),
  'mascotte-accueil', 'site-patrimoine', 'envie-sur-l-eau', 'mode-transport', 'mode-voiture', 'meteo-soleil', 'affluence-banc-calme',
];

export async function loadAssets(url) {
  const svgs = {};
  const texts = await Promise.all(SVGS.map((name) => fetch(url(`ill/${name}.svg`)).then((r) => (r.ok ? r.text() : Promise.reject(new Error(name))))));
  SVGS.forEach((name, i) => (svgs[name] = texts[i]));
  const mascot = new Image();
  mascot.src = url('ill/mascotte-accueil.svg');
  await Promise.all([
    mascot.decode(),
    ...['600 40px "Fredoka Variable"', '500 40px "Fredoka Variable"', '600 40px "Nunito Variable"', '700 40px "Nunito Variable"'].map((f) => document.fonts.load(f)),
  ]);
  return { svgs, mascot };
}

/**
 * The book, played back for the film. The same paper, crowd and lens as the
 * presentation, but time only moves when a frame is asked for, in fixed steps
 * from the first frame: any frame comes out the same on any render worker.
 */
export function createFilmStage(canvas, assets, { width, height, pixelRatio = 1 }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // Shadows are cast once per frame, however many exposures the frame takes.
  renderer.shadowMap.autoUpdate = false;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#062A33');
  scene.fog = new THREE.Fog('#062A33', 46, 110);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.16;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(FOV, width / height, 1, 140);

  const sun = new THREE.DirectionalLight('#fff', 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 15, bottom: -13, near: 2, far: 60 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 3.2;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#D4EFF1', '#F0E2C4', 1.7);
  scene.add(hemi);
  const rim = new THREE.SpotLight('#9AD3CD', 120, 60, 0.6, 0.7, 2);
  rim.position.set(-9, 13, -17);
  rim.target.position.set(0, 1, 0);
  scene.add(rim, rim.target);

  const world = buildWorld({ renderer, svgs: assets.svgs, mascot: assets.mascot });
  scene.add(world.root);
  const crowdLayer = new THREE.Group();
  scene.add(crowdLayer);
  const crowd = new Crowd(crowdLayer, assets.svgs);

  // The Éclaireurs, the tourist office and its widget come on for their own scene,
  // leave, and return for the bow before the book closes.
  const calls = new Map([
    [world.kiosk, [[T.kiosk, T.widgetOut + 0.5], [T.bow, Infinity]]],
    [world.board, [[T.board, T.widgetOut + 0.3], [T.bow + 0.3, Infinity]]],
  ]);
  Object.entries(HEROES).forEach(([id, x], i) => {
    world.heroes[id].root.position.x = x;
    calls.set(world.heroes[id], [[T.heroes[i], T.besoinsOut + 0.4 + i * 0.1], [T.bow + i * 0.12, Infinity]]);
  });

  let fx = null;
  let fxParts = [];
  function buildEffects() {
    for (const part of fxParts) {
      scene.remove(part);
      part.geometry.dispose();
      part.material.dispose();
    }
    const before = new Set(scene.children);
    fx = buildFx(scene);
    fx.resize(height, pixelRatio);
    // On a cinema-sized frame the fireflies need to be more than a pixel or two.
    fx.fireflies.material.uniforms.uSize.value *= 2.4;
    fxParts = scene.children.filter((child) => !before.has(child));
  }

  const lens = new Lens(renderer, scene, camera);
  const shutter = new Shutter(renderer);
  const point = new THREE.Vector3();
  const centre = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const target = new THREE.Vector3();
  const sunDir = new THREE.Vector3();
  const sunColor = new THREE.Color();
  const cA = new THREE.Color(), cB = new THREE.Color();
  const mix = (key, a, b, k, out) => out.copy(cA.set(a[key])).lerp(cB.set(b[key]), k);

  const levels = { paladru: 'calme', sauget: 'calme', lauvitel: 'calme' };
  const sim = { frame: 0, step: 0, cue: 0, moved: 0, signalled: false, partner: PARTNERS[0], chance: rng(53) };
  const shot = { focus: 30, blur: 0.5 };

  function setPartner(partner, kick) {
    sim.partner = partner;
    world.widget.draw(partner);
    world.awningMat.color.set(partner.colours.primaire);
    if (kick) world.board.speed += 1.6;
  }

  function reset() {
    Object.assign(sim, { frame: 0, step: 0, cue: 0, moved: 0, signalled: false, chance: rng(53) });
    Object.assign(levels, { paladru: 'calme', sauget: 'calme', lauvitel: 'calme' });
    for (const p of world.popups) p.set(0);
    for (const hero of Object.values(world.heroes)) hero.hop = 0;
    setPartner(PARTNERS[0], false);
    crowd.random = rng(101);
    for (const site of Object.values(crowd.sites)) {
      site.members.length = 0;
      Object.assign(site, { target: 0, mood: 'content', clock: 0 });
      for (const slot of site.slots) slot.taken = null;
    }
    for (const f of crowd.all) {
      f.pivot.visible = false;
      f.travel = null;
      f.redress = undefined;
    }
    crowd.pool = [...crowd.all];
    buildEffects();
    crowd.onArrive = (p) => {
      if (sim.chance() < 0.35) fx.burst(p, 3, 0.45);
    };
  }

  function light(t) {
    const h = hourAt(t);
    let i = 0;
    while (i < SKY.length - 2 && h > SKY[i + 1].h) i++;
    const a = SKY[i], b = SKY[i + 1];
    const k = clamp01((h - a.h) / (b.h - a.h));
    const theta = THREE.MathUtils.lerp(-64, 64, clamp01((h - 8) / 12)) * RAD;

    world.sunArm.rotation.z = -theta;
    sun.position.set(Math.sin(theta) * 14 + 5, 2.6 + Math.cos(theta) * 6.6, 6);
    mix('sun', a, b, k, sun.color);
    sun.intensity = THREE.MathUtils.lerp(a.power, b.power, k);
    mix('sky', a, b, k, hemi.color);
    mix('ground', a, b, k, hemi.groundColor);
    hemi.intensity = THREE.MathUtils.lerp(a.fill, b.fill, k);
    mix('back', a, b, k, scene.background);
    scene.fog.color.copy(scene.background);

    const dusk = clamp01((h - 18.2) / 1.6);
    world.glowMat.opacity = dusk;
    rim.intensity = 120 + 200 * dusk;
    sunColor.copy(sun.color).multiplyScalar(sun.intensity);
    paperUniforms.uSunColor.value.copy(sunColor);
    return { dusk, day: 1 - clamp01(Math.abs(h - 13.5) / 6.5) * 0.8, sunColor };
  }

  function direct(t) {
    world.setCover(coverAt(t));
    world.setLoose(looseAt(t));
    for (const p of world.popups) {
      const cued = calls.get(p);
      const up = p === world.sign ? sim.signalled : cued ? cued.some(([from, to]) => t > from && t < to) : t > T.pop + p.delay;
      p.target = up && t < T.fold + foldDelay(p.root.position.z) ? 1 : 0;
    }

    const open = t >= T.crowd && t < T.fold;
    const base = LEVELS[levelAt(hourAt(t))].crowd;
    const want = {
      paladru: Math.max(3, base - sim.moved),
      sauget: 4 + sim.moved,
      lauvitel: sim.signalled ? 23 : Math.min(23, Math.round(base / 2)),
    };
    for (const id in want) crowd.setTarget(id, open ? want[id] : 0);
    if (!open) return;
    levels.paladru = countToLevel(want.paladru);
    levels.sauget = countToLevel(want.sauget);
    levels.lauvitel = sim.signalled ? 'sature' : countToLevel(want.lauvitel);
    for (const id in levels) crowd.setMood(id, LEVELS[levels[id]].mood);
  }

  function play(event) {
    if (event.burst) fx.burst(point.set(...event.burst.at), event.burst.count, event.burst.power);
    if (event.redirect) {
      sim.moved = crowd.move('paladru', 'sauget', event.redirect);
      // A procession the camera can walk beside, rather than the presentation's dash.
      for (const f of crowd.all) {
        if (!f.travel) continue;
        f.travel.wait *= 2.6;
        f.travel.time *= 2;
        f.travel.hops = Math.round(f.travel.hops * 1.5);
      }
    }
    if (event.hop) world.heroes[event.hop].hop = 1;
    if (event.partner) setPartner(PARTNERS.find((p) => p.id === event.partner), !event.quiet);
    if (event.signal) {
      sim.signalled = true;
      fx.burst(point.set(9.85, 1.6, -3.1), 34, 1.1);
    }
  }

  function step() {
    const t = ++sim.step * DT;
    while (sim.cue < EVENTS.length && EVENTS[sim.cue].t <= t) play(EVENTS[sim.cue++]);
    direct(t);
    world.update(t, DT);
    crowd.update(t, DT);
    fx.update(t, DT, light(t));
  }

  function frameCamera(t) {
    const p = cameraAt(t);
    target.set(p.tx, p.ty, p.tz);
    offset.set(Math.sin(p.az) * Math.cos(p.el), Math.sin(p.el), Math.cos(p.az) * Math.cos(p.el)).multiplyScalar(p.dist);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    camera.setViewOffset(width, height, p.sx, p.sy, width, height);
    camera.updateMatrixWorld();
    lens.grade.uniforms.uCentre.value.set(0.5 - p.sx / width, 0.5 + p.sy / height);
    shot.focus = p.dist;
    shot.blur = p.blur;
  }

  /** One exposure for every pixel and a half the picture slides while the shutter is open. */
  function exposures(t) {
    frameCamera(t);
    centre.copy(target);
    const reach = shot.focus * 0.25;
    const seen = () => MARKS.map(([dx, dz]) => point.set(centre.x + dx * reach, 0, centre.z + dz * reach).project(camera).clone());
    frameCamera(t - SHUTTER / 2);
    const open = seen();
    frameCamera(t + SHUTTER / 2);
    const slide = Math.max(...seen().map((p, i) => Math.hypot(((p.x - open[i].x) * width) / 2, ((p.y - open[i].y) * height) / 2)));
    frameCamera(t);
    return Math.min(MAX_EXPOSURES, Math.max(1, Math.ceil(slide / 1.5)));
  }

  // The table is swept where the words will lie: an offcut under a title reads as punctuation.
  {
    const matrix = new THREE.Matrix4();
    const swept = new THREE.Matrix4().makeScale(0, 0, 0);
    const edge = 36;
    const offcuts = world.root.children.filter((child) => child.isInstancedMesh);
    for (const t of [0, T.intro, T.introOut, T.open, T.end, (T.end + DURATION) / 2, DURATION]) {
      frameCamera(t);
      for (const mesh of offcuts) {
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, matrix);
          point.setFromMatrixPosition(matrix).project(camera);
          const x = (point.x * 0.5 + 0.5) * width, y = (-point.y * 0.5 + 0.5) * height;
          if (x < WORDS.left - edge || x > WORDS.left + WORDS.width + edge || y < WORDS.top - edge || y > WORDS.top + WORDS.height + edge) continue;
          mesh.setMatrixAt(i, swept);
          mesh.instanceMatrix.needsUpdate = true;
        }
      }
    }
  }

  reset();

  return {
    /** Brings the book to that frame and says where the labels go. */
    seek(frame) {
      if (frame < sim.frame) reset();
      while (sim.frame < frame) {
        for (let i = 0; i < SUBSTEPS; i++) step();
        sim.frame++;
      }
      const t = frame / FPS;
      direct(t);
      world.update(t, 0);
      const lit = light(t);
      fx.update(t, 0, lit);
      // Glints and fireflies belong to the open landscape.
      const out = world.looseScale;
      fx.glints.material.uniforms.uAmount.value *= out;
      fx.fireflies.material.uniforms.uAmount.value *= out;
      frameCamera(t);
      shot.t = t;

      const at = {};
      for (const [id, [x, y, z]] of Object.entries(POINTS)) {
        point.set(x, y, z).project(camera);
        at[id] = { x: (point.x * 0.5 + 0.5) * width, y: (-point.y * 0.5 + 0.5) * height };
      }
      return { at, levels: { ...levels }, signalled: sim.signalled, partner: sim.partner, sun: `#${sun.color.getHexString()}` };
    },

    draw() {
      const count = exposures(shot.t);
      renderer.shadowMap.needsUpdate = true;
      shutter.take(count, (k) => {
        frameCamera(shot.t + ((k + 0.5) / count - 0.5) * SHUTTER);
        sunDir.copy(sun.position).normalize().transformDirection(camera.matrixWorldInverse);
        paperUniforms.uSunDirView.value.copy(sunDir);
        lens.render(shot.t, shot.focus, shot.blur);
      });
      frameCamera(shot.t);
    },

    dispose() {
      renderer.dispose();
    },
  };
}
