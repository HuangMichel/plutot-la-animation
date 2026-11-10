import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { C, paperUniforms } from './paper.js';
import { buildWorld } from './world.js';
import { buildFx } from './fx.js';
import { Crowd } from './crowd.js';
import { Lens } from './post.js';
import { LEVELS, STOPS, SHOTS, NEEDS, countToLevel, levelAt } from '../data.js';

const FOV = 30;
const RAD = Math.PI / 180;
const VIEWS = [...STOPS, ...SHOTS];
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// The light through the day. Hours between the keys are interpolated.
const SKY = [
  { h: 8, sun: '#FFD2A6', power: 1.9, sky: '#BFE1EC', ground: '#E8D2B0', fill: 0.7, back: '#04222B' },
  { h: 11, sun: '#FFF1DC', power: 2.3, sky: '#D4EFF1', ground: '#F0E2C4', fill: 0.85, back: '#062A33' },
  { h: 15, sun: '#FFF3DE', power: 2.35, sky: '#D4EFF1', ground: '#F0E2C4', fill: 0.85, back: '#062A33' },
  { h: 18, sun: '#FFC27A', power: 2.5, sky: '#C9DEDA', ground: '#F0CFA0', fill: 0.7, back: '#04222B' },
  { h: 20, sun: '#FFA35C', power: 3.0, sky: '#9DBDC2', ground: '#EDB98A', fill: 0.66, back: '#021C24' },
];

export function createStage(canvas, assets, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#062A33');
  scene.fog = new THREE.Fog('#062A33', 46, 110);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.16;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 140);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, {
    enableDamping: !reducedMotion, dampingFactor: 0.08, enablePan: false, rotateSpeed: 0.55, zoomSpeed: 0.7,
    minDistance: 7, maxDistance: 64, minPolarAngle: 20 * RAD, maxPolarAngle: 84 * RAD, minAzimuthAngle: -80 * RAD, maxAzimuthAngle: 80 * RAD,
  });

  // Light.
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
  const fx = buildFx(scene);
  const crowdLayer = new THREE.Group();
  scene.add(crowdLayer);
  const crowd = new Crowd(crowdLayer, assets.svgs);
  crowd.onArrive = (p) => {
    if (!reducedMotion && Math.random() < 0.35) fx.burst(p, 3, 0.45);
  };
  crowdLayer.visible = false;

  const lens = new Lens(renderer, scene, camera);

  // ---- State ---------------------------------------------------------------
  const state = {
    stop: STOPS[0], hour: 15, shownHour: 15, moved: 0, need: 'aucun', signalled: false,
    insets: { left: 0, right: 0, top: 0, bottom: 0 }, width: 1, height: 1, ratio: 1,
    ready: false, userMoved: false, blur: STOPS[0].blur, focus: 30,
  };
  const levels = { paladru: 'sature', sauget: 'calme', lauvitel: 'charge' };
  let onLevels = () => {};
  let tween = null;

  function syncCrowd() {
    const base = LEVELS[levelAt(state.hour)].crowd;
    const paladru = Math.max(3, base - state.moved);
    const sauget = 4 + state.moved;
    const away = NEEDS[state.need].fold?.includes('lauvitel');
    crowd.setTarget('paladru', paladru);
    crowd.setTarget('sauget', sauget);
    crowd.setTarget('lauvitel', away ? 0 : 23);
    levels.paladru = countToLevel(paladru);
    levels.sauget = countToLevel(sauget);
    levels.lauvitel = state.signalled ? 'sature' : 'charge';
    for (const id of Object.keys(levels)) crowd.setMood(id, LEVELS[levels[id]].mood);
    onLevels({ ...levels });
  }

  // The « plein » sign stands only once the book is open, the site is
  // signalled, and the site itself is still on the page.
  function syncSign() {
    const folded = NEEDS[state.need].fold?.includes('lauvitel');
    world.sign.target = state.ready && state.signalled && !folded ? 1 : 0;
    if (reducedMotion) world.sign.set(world.sign.target);
  }

  // ---- Frame budget --------------------------------------------------------
  // Slow frames have two possible causes that look exactly alike from here: a
  // machine that cannot keep up, or a display held at 30 Hz to save power. So
  // before giving anything up, a few frames are rendered back to back and the
  // GPU made to finish: what one frame really costs. If that is too much, the
  // resolution goes first, then the depth of field.
  const gl = renderer.getContext();
  const probe = new Uint8Array(4);
  const budget = { watching: true, frames: 0, slow: 0, cost: 0, limit: 20, lowRes: false };

  /** Counts slow frames; true each time most of the last ninety were. */
  function lagging(dt) {
    if (!budget.watching || !intro.done) return false;
    if (dt > 0.024) budget.slow++;
    if (++budget.frames < 90) return false;
    const yes = budget.slow > 60;
    budget.frames = budget.slow = 0;
    return yes;
  }

  /** Draws this frame four times over to learn what one costs, then decides. */
  function weigh(draw) {
    const t0 = performance.now();
    for (let i = 0; i < 4; i++) draw();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, probe); // returns once the GPU is done
    budget.cost = (performance.now() - t0) / 4;
    if (budget.cost < budget.limit) {
      budget.watching = false; // the display sets the pace, not the scene
      return;
    }
    if (!budget.lowRes && state.ratio > 1) {
      budget.lowRes = true;
      resize(state.width, state.height);
    } else {
      lens.dofOn = false;
      budget.watching = false;
    }
    draw(); // resizing emptied the canvas
  }

  // ---- Camera --------------------------------------------------------------
  const pose = { target: new THREE.Vector3(), az: 0, el: 0.5, dist: 30 };
  const offset = new THREE.Vector3();

  function frame(stop) {
    const { left, right, top, bottom } = state.insets;
    const freeW = Math.max(120, state.width - left - right);
    const freeH = Math.max(120, state.height - top - bottom);
    const dist = Math.max((stop.span[0] * state.height) / freeW, (stop.span[1] * state.height) / freeH) / (2 * Math.tan((FOV * RAD) / 2));
    return { target: new THREE.Vector3(...stop.target), az: stop.az * RAD, el: stop.el * RAD, dist };
  }

  function applyPose(p) {
    offset.set(Math.sin(p.az) * Math.cos(p.el), Math.sin(p.el), Math.cos(p.az) * Math.cos(p.el)).multiplyScalar(p.dist);
    camera.position.copy(p.target).add(offset);
    controls.target.copy(p.target);
    camera.lookAt(p.target);
  }

  function readPose() {
    offset.copy(camera.position).sub(controls.target);
    pose.dist = offset.length();
    pose.el = Math.asin(offset.y / pose.dist);
    pose.az = Math.atan2(offset.x, offset.z);
    pose.target.copy(controls.target);
    return pose;
  }

  function goTo(stop, { instant = false } = {}) {
    state.stop = stop;
    state.userMoved = false;
    const to = frame(stop);
    if (instant || reducedMotion || !state.ready) {
      tween = null;
      applyPose(to);
      controls.update();
      state.blur = stop.blur;
      return 0;
    }
    const from = { ...readPose(), target: pose.target.clone() };
    const travel = from.target.distanceTo(to.target);
    tween = { from, to, t: 0, time: 1.25 + Math.min(1.1, travel * 0.06), lift: Math.min(5, travel * 0.22), blur: [state.blur, stop.blur] };
    controls.enabled = false;
    return tween.time;
  }

  function layout() {
    const { left, right, top, bottom } = state.insets;
    camera.aspect = state.width / state.height;
    // Portrait views need more distance than the desktop orbit limit allows.
    // Keep every authored view reachable, including after the reader takes over.
    controls.maxDistance = Math.max(64, ...VIEWS.map((view) => frame(view).dist));
    camera.far = Math.max(140, controls.maxDistance + 50);
    camera.setViewOffset(state.width, state.height, (right - left) / 2, (bottom - top) / 2, state.width, state.height);
    camera.updateProjectionMatrix();
    lens.grade.uniforms.uCentre.value.set(0.5 - (right - left) / 2 / state.width, 0.5 + (bottom - top) / 2 / state.height);
    // A flight in progress lands on the new framing; the idle drift reads it every frame.
    if (tween) tween.to = frame(state.stop);
    else if (!state.userMoved && state.ready && reducedMotion) goTo(state.stop, { instant: true });
  }

  function resize(width, height, pixelRatio = state.ratio) {
    state.width = width;
    state.height = height;
    state.ratio = pixelRatio;
    renderer.setPixelRatio(budget.lowRes ? Math.min(1, pixelRatio) : pixelRatio);
    renderer.setSize(width, height, false);
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    lens.setSize(size.x, size.y);
    fx.resize(height, pixelRatio);
    layout();
  }

  controls.addEventListener('start', () => {
    state.userMoved = true;
    tween = null;
    api.onGrab?.();
  });

  // ---- Time of day ---------------------------------------------------------
  const cA = new THREE.Color(), cB = new THREE.Color();
  const sunColor = new THREE.Color();
  const sunDir = new THREE.Vector3();
  const mix = (key, a, b, k, out) => out.copy(cA.set(a[key])).lerp(cB.set(b[key]), k);

  function applyHour(h) {
    let i = 0;
    while (i < SKY.length - 2 && h > SKY[i + 1].h) i++;
    const a = SKY[i], b = SKY[i + 1];
    const k = clamp01((h - a.h) / (b.h - a.h));
    const s = clamp01((h - 8) / 12);
    const theta = THREE.MathUtils.lerp(-64, 64, s) * RAD;

    world.sunArm.rotation.z = -theta;
    // The lamp stays on the reader's side and a little to the right, so shadows
    // rake across the page instead of hiding behind the sheets that cast them.
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
    return { dusk, day: 1 - clamp01(Math.abs(h - 13.5) / 6.5) * 0.8 };
  }

  // ---- Opening -------------------------------------------------------------
  const intro = { t: 0, done: false, crowdIn: false, burst: 0 };
  const closedPose = { target: new THREE.Vector3(5.6, 0.2, 0.2), az: 12 * RAD, el: 50 * RAD, dist: 30 };

  function finishIntro() {
    intro.done = true;
    world.setCover(1);
    world.setLoose(1);
    for (const p of world.popups) if (!p.manual) p.set(1);
    crowdLayer.visible = true;
    state.ready = true;
    controls.enabled = true;
    syncSign();
  }

  function runIntro(dt) {
    intro.t += dt;
    const t = intro.t;
    world.setCover(ease(clamp01((t - 0.55) / 1.7)));
    for (const p of world.popups) if (!p.manual && p.target === 0 && t > 1.75 + p.delay) p.target = 1;
    if (t > 2.05 && intro.burst < 5 && t > 2.05 + intro.burst * 0.22) {
      const at = [[-5.6, 2.5, -5.5], [5.6, 3, -5.5], [-5.6, 0.6, 1], [3.2, 2, -0.9], [0, 1, 5.5]][intro.burst++];
      fx.burst(new THREE.Vector3(...at), 22, 1.25);
    }
    world.setLoose(ease(clamp01((t - 2.9) / 0.8)));
    if (t > 3.0 && !intro.crowdIn) {
      intro.crowdIn = true;
      crowdLayer.visible = true;
    }
    const k = ease(clamp01((t - 0.4) / 3.4));
    const to = frame(state.stop);
    applyPose({
      target: closedPose.target.clone().lerp(to.target, k),
      az: THREE.MathUtils.lerp(closedPose.az, to.az, k),
      el: THREE.MathUtils.lerp(closedPose.el, to.el, k),
      dist: THREE.MathUtils.lerp(Math.min(closedPose.dist, to.dist * 0.82), to.dist, k),
    });
    if (t > 4.1) {
      state.ready = true;
      intro.done = true;
      controls.enabled = true;
      controls.update();
      idle = 0;
      syncSign();
      api.onReady?.();
    }
  }

  // ---- Loop ----------------------------------------------------------------
  const timer = new THREE.Timer();
  timer.connect(document);
  const projected = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const blockers = [world.left, world.right];
  let elapsed = 0;
  let idle = 0;

  function tick() {
    timer.update();
    const dt = Math.min(0.05, timer.getDelta());
    elapsed += reducedMotion ? 0 : dt;

    if (!intro.done) runIntro(dt);
    else if (tween) {
      tween.t = Math.min(1, tween.t + dt / tween.time);
      const k = ease(tween.t);
      const { from, to } = tween;
      applyPose({
        target: from.target.clone().lerp(to.target, k),
        az: THREE.MathUtils.lerp(from.az, to.az, k),
        el: THREE.MathUtils.lerp(from.el, to.el, k) + Math.sin(k * Math.PI) * 0.04,
        dist: THREE.MathUtils.lerp(from.dist, to.dist, k) + Math.sin(k * Math.PI) * tween.lift,
      });
      state.blur = THREE.MathUtils.lerp(tween.blur[0], tween.blur[1], k);
      if (tween.t >= 1) {
        tween = null;
        controls.enabled = true;
        idle = 0;
      }
    } else {
      if (!state.userMoved && !reducedMotion) {
        // A slow drift around the view while nobody is touching the book. It
        // starts from rest, so a flight hands over to it without a jolt.
        idle += dt;
        const p = readPose();
        const base = frame(state.stop);
        const ramp = Math.min(1, idle / 2.5);
        const k = ramp * ramp * (3 - 2 * ramp);
        p.az = base.az + Math.sin(idle * 0.23) * (state.stop.sway ?? 2) * RAD * k;
        p.el = base.el + Math.sin(idle * 0.17) * 0.008 * k;
        p.dist = base.dist;
        p.target = base.target;
        applyPose(p);
      }
      controls.update();
    }

    state.shownHour += (state.hour - state.shownHour) * (reducedMotion ? 1 : Math.min(1, dt * 3.2));
    const light = applyHour(state.shownHour);

    const motionDelta = reducedMotion ? 0 : dt;
    world.update(elapsed, motionDelta);
    if (!reducedMotion) crowd.update(elapsed, dt);
    fx.update(elapsed, motionDelta, { ...light, sunColor });

    sunDir.copy(sun.position).normalize().transformDirection(camera.matrixWorldInverse);
    paperUniforms.uSunDirView.value.copy(sunDir);

    const focus = camera.position.distanceTo(controls.target);
    // Backing away to fit a narrow viewport must not hide the book in fog.
    const extraDistance = Math.max(0, focus - 64);
    scene.fog.near = 46 + extraDistance;
    scene.fog.far = 110 + extraDistance;
    state.focus += (focus - state.focus) * (reducedMotion ? 1 : Math.min(1, dt * 6));
    const draw = () => lens.render(elapsed, state.focus, state.blur);
    if (lagging(dt)) weigh(draw);
    else draw();

    api.onFrame?.();
  }

  const api = {
    renderer, camera, levels, lens, sun, budget,
    onFrame: null, onReady: null, onGrab: null,
    get ready() { return state.ready; },
    get need() { return state.need; },
    set onLevels(fn) { onLevels = fn; fn({ ...levels }); },

    start() {
      applyHour(state.hour);
      syncCrowd();
      if (reducedMotion) {
        finishIntro();
        crowd.settle();
        goTo(state.stop, { instant: true });
        api.onReady?.();
      } else {
        controls.enabled = false;
        applyPose(closedPose);
      }
      renderer.setAnimationLoop(tick);
    },
    resize,
    setInsets(insets) {
      Object.assign(state.insets, insets);
      layout();
    },
    /** Flies the lens to a view; returns how long the flight takes, in seconds. */
    goTo(id, opts) {
      const view = VIEWS.find((v) => v.id === id);
      return view ? goTo(view, opts) : 0;
    },
    /** Hands the lens to the reader at once, even in the middle of a flight. */
    release() {
      if (!tween) return;
      tween = null;
      controls.enabled = true;
      state.userMoved = true;
    },
    setHour(h) {
      state.hour = h;
      syncCrowd();
      if (reducedMotion) crowd.settle();
    },
    redirect(on) {
      const want = on ? 15 : 0;
      if (want === state.moved) return;
      // Whoever is standing walks the path; the counts are settled either way.
      if (on) crowd.move('paladru', 'sauget', want);
      else crowd.move('sauget', 'paladru', state.moved, true);
      state.moved = want;
      syncCrowd();
      if (reducedMotion) crowd.settle();
    },
    setNeed(id) {
      state.need = id;
      const need = NEEDS[id];
      const folded = need.fold?.includes('lauvitel');
      for (const p of world.lauvitel) p.target = folded ? 0 : 1;
      syncSign();
      if (!reducedMotion) world.heroes[need.hero].hop = 1;
      if (reducedMotion) for (const p of world.popups) p.set(p.target);
      syncCrowd();
      if (reducedMotion) crowd.settle();
    },
    signal(on) {
      state.signalled = on;
      syncSign();
      if (on && state.ready && !reducedMotion) fx.burst(new THREE.Vector3(9.85, 1.6, -3.1), 34, 1.1);
      syncCrowd();
      if (reducedMotion) crowd.settle();
    },
    setPartner(partner) {
      world.widget.draw(partner);
      world.awningMat.color.set(partner.colours.primaire);
      if (!reducedMotion && state.ready) world.board.speed += 1.6;
    },
    /** Screen position of a point of the scene, for the pins. */
    project(point, out) {
      projected.set(point[0], point[1], point[2]).project(camera);
      out.x = (projected.x * 0.5 + 0.5) * state.width;
      out.y = (-projected.y * 0.5 + 0.5) * state.height;
      const { left, right, top, bottom } = state.insets;
      out.visible = state.ready && projected.z < 1 && out.x > left + 24 && out.x < state.width - right - 24 && out.y > top + 30 && out.y < state.height - bottom;
      return out;
    },
    /** True when paper stands between the lens and that point. */
    hidden(point) {
      projected.set(point[0], point[1], point[2]);
      const reach = projected.distanceTo(camera.position);
      ray.set(camera.position, projected.sub(camera.position).normalize());
      ray.far = reach - 0.6;
      return ray.intersectObjects(blockers, true).length > 0;
    },
  };
  return api;
}
