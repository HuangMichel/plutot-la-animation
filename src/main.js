import './style.css';
import { ANCHORS, BEATS, FOLDED, HOURS, LEVELS, LEVEL_COLOURS, NEEDS, PARTNERS, START, STOPS, countToLevel, levelAt } from './data.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const root = document.documentElement;
const base = import.meta.env.BASE_URL;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const SVGS = [
  ...['chapeau', 'canne', 'fauteuil', 'chien'].flatMap((c) => ['', '-surpris', '-fatigue'].map((m) => `eclaireur-${c}${m}`)),
  'mascotte-accueil', 'site-patrimoine', 'envie-sur-l-eau', 'mode-transport', 'mode-voiture', 'meteo-soleil', 'affluence-banc-calme',
];

const PINS = [
  { id: 'paladru', name: 'Lac de Paladru', site: 'paladru' },
  { id: 'chemin', name: 'Étang du Sauget', site: 'sauget' },
  { id: 'besoins', name: 'Les Éclaireurs' },
  { id: 'gestionnaire', name: 'Lac du Lauvitel', site: 'lauvitel' },
  { id: 'widget', name: 'Office de tourisme' },
];

// Notes the needs page pins on the scene: above a site's pin, or on a landmark that has none.
const NOTES = { paladru: 'paladru', lauvitel: 'gestionnaire', bastille: null };

function webgl2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

async function loadAssets() {
  const svgs = {};
  const texts = await Promise.all(SVGS.map((name) => fetch(`${base}ill/${name}.svg`).then((r) => (r.ok ? r.text() : Promise.reject(new Error(name))))));
  SVGS.forEach((name, i) => (svgs[name] = texts[i]));
  const mascot = new Image();
  mascot.src = `${base}ill/mascotte-accueil.svg`;
  await Promise.all([
    mascot.decode().catch(() => {}),
    document.fonts.load('600 40px "Fredoka Variable"'),
    document.fonts.load('500 40px "Fredoka Variable"'),
    document.fonts.load('600 40px "Nunito Variable"'),
    document.fonts.load('700 40px "Nunito Variable"'),
  ]);
  return { svgs, mascot };
}

// ---- The panel works with or without the scene -----------------------------

const ui = {
  hour: $('#hour'), hourOut: $('#hour-out'), bars: $('#bars'), verdict: $('#verdict'), verdictName: $('#verdict-name'), verdictAdvice: $('#verdict-advice'),
  redirect: $('#redirect'), redirectStatus: $('#redirect-status'), needRule: $('#need-rule'), signal: $('#signal'), signalStatus: $('#signal-status'),
  partners: $('#partners'), codePartner: $('#code-partner'), panel: $('#contenu'), scene: $('#scene'),
  auto: $('#auto'), autoLabel: $('#auto-label'), announce: $('#announce'),
};
let stage = null;

// Where the story stands: what the panel says right now. The scene is told the
// same thing a moment later, once the lens can see it (see `tellSceneIn`).
const shown = { stop: 'livre', view: 'livre', ...START };
const staged = { ...START }; // what the scene has been told so far
let hourGoal = START.hour; // the hour the clock is running to

for (const h of HOURS) {
  const bar = document.createElement('i');
  bar.style.setProperty('--h', h.height);
  bar.style.setProperty('--c', LEVEL_COLOURS[h.level]);
  ui.bars.append(bar);
}

// The panel's side of each thing the story can change.
const panel = {
  hour(hour) {
    const level = levelAt(hour);
    shown.hour = hour;
    ui.hour.value = hour;
    ui.hourOut.textContent = `${hour}\u00a0h`;
    ui.hour.setAttribute('aria-valuetext', `${hour}\u00a0h, ${LEVELS[level].name}`);
    ui.verdict.dataset.level = level;
    ui.verdictName.textContent = LEVELS[level].name;
    ui.verdictAdvice.textContent = LEVELS[level].advice;
    $$('i', ui.bars).forEach((bar, i) => bar.classList.toggle('is-now', i === hour - 8));
    panel.redirect();
  },
  redirect(on = shown.redirect) {
    shown.redirect = on;
    const level = levelAt(shown.hour);
    const count = LEVELS[level].crowd;
    const left = count - 15;
    const after = countToLevel(left);
    ui.redirect.setAttribute('aria-pressed', String(on));
    ui.redirect.textContent = on ? 'Revenir au lac' : 'Trouver un coin plus calme';
    ui.redirectStatus.textContent = on
      ? `15 figurines prennent le chemin de l’étang du Sauget. Le lac passe de ${LEVELS[level].name.toLowerCase()} à ${LEVELS[after].name.toLowerCase()}.`
      : `À ${shown.hour}\u00a0h, le lac est ${LEVELS[level].name.toLowerCase()}\u00a0: ${count} figurines sur la plage.`;
  },
  need(id) {
    shown.need = id;
    $(`input[name="need"][value="${id}"]`).checked = true;
    ui.needRule.textContent = NEEDS[id].rule;
  },
  signal(on) {
    shown.signal = on;
    ui.signal.setAttribute('aria-pressed', String(on));
    ui.signal.textContent = on ? 'Lever maintenant' : 'Publier le signalement';
    ui.signalStatus.textContent = on
      ? 'C’est publié\u202f! Le lac du Lauvitel est signalé saturé, parking plein. Il n’est plus proposé en alternative.'
      : 'Lac du Lauvitel\u00a0: chargé, d’après l’estimation.';
  },
  partner(id) {
    shown.partner = id;
    $(`input[name="partner"][value="${id}"]`).checked = true;
    ui.codePartner.textContent = id;
  },
};

// The scene's side. The hour is not here: the clock runs in both at once.
const scene = {
  need: (id) => stage.setNeed(id),
  signal: (on) => stage.signal(on),
  partner: (id) => stage.setPartner(PARTNERS.find((p) => p.id === id)),
  redirect: (on) => stage.redirect(on),
};

/** Tells the scene whatever the panel says that it has not heard yet. */
function tellScene() {
  if (!stage) return;
  for (const [key, tell] of Object.entries(scene)) {
    if (staged[key] === shown[key]) continue;
    staged[key] = shown[key];
    tell(shown[key]);
  }
  showNotes(NEEDS[staged.need].notes ?? {});
}

let waiting = 0;
/**
 * Tells the scene now, or once the lens has had `seconds` to get in place:
 * paper that folds before the camera arrives is paper nobody saw fold.
 */
function tellSceneIn(seconds) {
  clearTimeout(waiting);
  if (seconds > 0) waiting = setTimeout(tellScene, seconds * 1000);
  else tellScene();
}

function setHour(hour) {
  panel.hour(hour);
  stage?.setHour(hour);
}

let sweep = 0;
/** Runs the clock to `target` one hour at a time, so the day is seen passing. */
function sweepHour(target, pace = 150, then) {
  clearInterval(sweep);
  if (reducedMotion || !stage?.ready || target === shown.hour) {
    setHour(target);
    then?.();
    return;
  }
  sweep = setInterval(() => {
    setHour(shown.hour + Math.sign(target - shown.hour));
    if (shown.hour !== target) return;
    clearInterval(sweep);
    then?.();
  }, pace);
}

// The reader's hand on a control: the tour stops, the panel answers at once.

ui.hour.addEventListener('input', () => {
  pause();
  clearInterval(sweep);
  hourGoal = Number(ui.hour.value);
  // The crowd on the path belongs to the hour it left at.
  panel.redirect(false);
  tellSceneIn(0);
  setHour(hourGoal);
});

ui.redirect.addEventListener('click', () => {
  pause();
  panel.redirect(!shown.redirect);
  tellSceneIn(0);
});

$$('input[name="need"]').forEach((input) =>
  input.addEventListener('change', () => {
    pause();
    panel.need(input.value);
    tellSceneIn(look(viewFor('besoins', input.value)) * 0.7);
  }),
);

ui.signal.addEventListener('click', () => {
  pause();
  panel.signal(!shown.signal);
  tellSceneIn(0);
});

PARTNERS.forEach((p) => {
  const label = document.createElement('label');
  const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'partner', value: p.id, checked: p.id === START.partner });
  const swatch = document.createElement('span');
  swatch.className = 'swatch';
  swatch.setAttribute('aria-hidden', 'true');
  for (const c of [p.colours.primaire, p.colours.carte, p.colours.texte]) {
    const dot = document.createElement('i');
    dot.style.background = c;
    swatch.append(dot);
  }
  const name = document.createElement('span');
  name.textContent = p.name;
  label.append(input, swatch, name);
  ui.partners.append(label);
  input.addEventListener('change', () => {
    pause();
    panel.partner(p.id);
    tellSceneIn(0);
  });
});

// ---- Pages, and the beats that make up the story ---------------------------

const viewFor = (stop, need) => (stop === 'besoins' ? (NEEDS[need].view ?? stop) : stop);

function showStop(id, { focus = false } = {}) {
  if (id !== shown.stop) {
    shown.stop = id;
    $$('.stop').forEach((s) => s.classList.toggle('is-active', s.id === id));
    $$('.tabs [data-go]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.go === id)));
    $$('.pin').forEach((b) => b.setAttribute('aria-current', String(b.dataset.go === id)));
    ui.panel.scrollTop = 0;
    history.replaceState(null, '', id === 'livre' ? location.pathname + location.search : `#${id}`);
    // Focus reads the heading out by itself; the tour needs the live region.
    if (!focus) ui.announce.textContent = $(`#${id} h1, #${id} h2`).textContent;
    requestAnimationFrame(measure);
  }
  if (focus) {
    const heading = $(`#${id} h1, #${id} h2`);
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

/**
 * Points the lens at a view and returns the seconds it takes to get there. A
 * view already framed is left as the reader turned it, unless forced.
 */
function look(view, { instant = false, force = false } = {}) {
  if (view === shown.view && !force) return 0;
  shown.view = view;
  return stage?.goTo(view, { instant }) ?? 0;
}

let beat = 0;

function stateAt(index) {
  const state = { ...START };
  for (let i = 0; i <= index; i++) Object.assign(state, BEATS[i].set);
  return state;
}

function applyBeat(index, { arriving = false, focus = false, instant = false, force = false } = {}) {
  beat = index;
  const { stop, via } = BEATS[index];
  const state = stateAt(index);
  showStop(stop, { focus });
  panel.need(state.need);
  panel.signal(state.signal);
  panel.partner(state.partner);
  panel.redirect(state.redirect);
  // A detour through another hour: rewind fast, then let the day play.
  if (arriving && via && !reducedMotion) sweepHour(via.hour, 60, () => sweepHour(state.hour, 280));
  else sweepHour(state.hour);
  hourGoal = state.hour;
  tellSceneIn(look(viewFor(stop, state.need), { instant, force }) * 0.7);
}

/** Would this beat change anything the reader can see? */
function differs(index, dir) {
  const { stop, via } = BEATS[index];
  if (stop !== shown.stop || (dir > 0 && via)) return true;
  const state = stateAt(index);
  return state.hour !== hourGoal || Object.keys(scene).some((key) => state[key] !== shown[key]);
}

function step(dir) {
  let next = beat + dir;
  while (BEATS[next] && !differs(next, dir)) next += dir;
  if (BEATS[next]) applyBeat(next, { arriving: dir > 0 });
}

function jump(stop, opts) {
  const id = STOPS.some((s) => s.id === stop) ? stop : 'livre';
  applyBeat(BEATS.findIndex((b) => b.stop === id), { ...opts, force: true });
}

// ---- The guided tour: the same beats, on a timer ---------------------------

const auto = { on: false, timer: 0, declined: false };

function showProgress() {
  const tab = $(`.tabs [data-go="${shown.stop}"]`);
  const holds = (beats) => beats.filter((b) => b.stop === shown.stop).reduce((sum, b) => sum + b.hold, 0);
  const total = holds(BEATS), before = holds(BEATS.slice(0, beat));
  tab.style.setProperty('--d', '0ms');
  tab.style.setProperty('--p', before / total);
  tab.getBoundingClientRect(); // commit the starting point before the fill runs
  tab.style.setProperty('--d', `${BEATS[beat].hold}ms`);
  tab.style.setProperty('--p', (before + BEATS[beat].hold) / total);
}

function schedule() {
  clearTimeout(auto.timer);
  if (!auto.on || document.hidden) return;
  showProgress();
  auto.timer = setTimeout(() => {
    applyBeat((beat + 1) % BEATS.length, { arriving: true });
    schedule();
  }, BEATS[beat].hold);
}

// While the tour runs, the panel's status lines change by themselves: only
// the page titles are read out, through the live region of `showStop`.
const statuses = $$('[role="status"]');

function play({ now = true } = {}) {
  auto.on = true;
  root.classList.add('is-auto');
  ui.autoLabel.textContent = 'Pause';
  statuses.forEach((el) => el.setAttribute('aria-live', 'off'));
  if (now) applyBeat((beat + 1) % BEATS.length, { arriving: true, force: true });
  schedule();
}

/** The reader takes over: every control, wheel step and drag comes through here. */
function pause() {
  auto.declined = true;
  if (!auto.on) return;
  auto.on = false;
  clearTimeout(auto.timer);
  root.classList.remove('is-auto');
  ui.autoLabel.textContent = 'Visite guidée';
  statuses.forEach((el) => el.removeAttribute('aria-live'));
}

ui.auto.addEventListener('click', () => (auto.on ? pause() : play()));
document.addEventListener('visibilitychange', schedule);
ui.panel.addEventListener('pointerdown', pause);
ui.panel.addEventListener('focusin', pause);

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-go]');
  if (!trigger || !root.classList.contains('has-scene')) return;
  event.preventDefault();
  pause();
  jump(trigger.dataset.go, { focus: !trigger.closest('.tabs') });
});

// ---- The scene --------------------------------------------------------------

const pins = [];
const notes = {};

function buildPins() {
  const layer = $('#pins');
  for (const def of PINS) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pin';
    el.dataset.go = def.id;
    const dot = def.site ? '<i></i>' : '';
    el.innerHTML = `${dot}<span><b></b>${def.site ? '<small></small>' : ''}</span>`;
    $('b', el).textContent = def.name;
    if (!def.site) el.style.gridTemplateColumns = 'auto';
    layer.append(el);
    pins.push({ ...def, el, home: ANCHORS[def.id], low: FOLDED[def.site], at: [...ANCHORS[def.id]], x: 0, y: 0, visible: false });
  }
  for (const [id, pinId] of Object.entries(NOTES)) {
    const el = document.createElement('p');
    el.className = 'note';
    el.setAttribute('aria-hidden', 'true'); // the panel's own status line says the same thing
    layer.append(el);
    const pin = pins.find((p) => p.id === pinId);
    // A note above a pin shares the pin's anchor, so the two travel together.
    notes[id] = { el, pin, at: pin ? pin.at : ANCHORS[id], x: 0, y: 0, visible: false, text: '' };
  }
}

function showNotes(map) {
  for (const [id, note] of Object.entries(notes)) {
    note.text = map[id] ?? '';
    // A note that goes away keeps its words while it fades out.
    if (note.text) note.el.textContent = note.text;
  }
}

let turn = 0;
const bounds = { right: innerWidth };
function placePins() {
  // One sight-line test per frame is plenty: pins behind paper fade out.
  const probe = pins[turn++ % pins.length];
  probe.hidden = probe.id !== shown.stop && stage.hidden(probe.at);
  const folded = NEEDS[stage.need].fold ?? [];
  for (const p of pins) {
    // A pin sinks with its site when the paper folds away.
    const goal = p.low && folded.includes(p.site) ? p.low : p.home;
    for (let i = 0; i < 3; i++) p.at[i] += (goal[i] - p.at[i]) * (reducedMotion ? 1 : 0.14);
    stage.project(p.at, p);
    p.visible &&= !p.hidden;
    p.el.classList.toggle('is-on', p.visible);
    if (!p.visible) continue;
    // Keep the whole label on screen; the tail may drift off its lake a little.
    const half = p.el.offsetWidth / 2 + 8;
    const x = Math.min(Math.max(p.x, half), bounds.right - half);
    p.el.style.transform = `translate(${x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%) translateY(-12px)`;
  }
  for (const n of Object.values(notes)) {
    stage.project(n.at, n);
    const on = n.visible && n.text !== '' && !n.pin?.hidden;
    n.el.classList.toggle('is-on', on);
    if (!on) continue;
    const half = n.el.offsetWidth / 2 + 8;
    const x = Math.min(Math.max(n.x, half), bounds.right - half);
    const lift = n.pin ? n.pin.el.offsetHeight + 20 : 8;
    n.el.style.transform = `translate(${x.toFixed(1)}px, ${n.y.toFixed(1)}px) translate(-50%, -100%) translateY(${-lift}px)`;
  }
}

function measure() {
  if (!stage) return;
  const wide = innerWidth > 860;
  const panel = ui.panel.getBoundingClientRect();
  const tabs = $('.tabs').getBoundingClientRect();
  const bar = $('.bar').getBoundingClientRect();
  if (!wide) root.style.setProperty('--dock', `${Math.round(panel.height)}px`);
  bounds.right = wide ? panel.left : innerWidth;
  stage.setInsets(
    wide
      ? { left: 0, right: innerWidth - panel.left, top: bar.height * 0.6, bottom: innerHeight - tabs.top }
      : { left: 0, right: 0, top: bar.height * 0.8, bottom: panel.height + tabs.height },
  );
}

/** The wheel's travel along the axis the gesture favours: down or leftward swipes are positive. */
function wheelDelta(event) {
  const sideways = Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey;
  const raw = sideways ? event.deltaX || event.deltaY : event.deltaY;
  return { sideways, delta: raw * (event.deltaMode === 1 ? 33 : event.deltaMode === 2 ? innerHeight : 1) };
}

/** Does this wheel gesture belong to something on the page that still has room to scroll that way? */
function scrollsItself(event) {
  const { sideways, delta } = wheelDelta(event);
  for (let el = event.target; el instanceof Element; el = el.parentElement) {
    if (!el.matches('.panel, .code, .tabs ul')) continue;
    const at = sideways ? el.scrollLeft : el.scrollTop;
    const room = sideways ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
    if (room > 1 && (delta > 0 ? at < room - 1 : at > 1)) return true;
  }
  return false;
}

function steer() {
  // One wheel gesture is one beat. A gesture is a run of wheel events with no
  // gap, so a mouse notch counts once and a trackpad's long glide counts once.
  // A fresh push in the middle of a glide's tail starts a new gesture.
  const wheel = { last: -Infinity, sum: 0, spent: false, own: false, at: 0, floor: Infinity };
  addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey || event.metaKey) return; // zoom and pinch: the camera takes them
      const t = event.timeStamp;
      const { delta } = wheelDelta(event);
      const size = Math.abs(delta);
      const fresh = t - wheel.last > 160 || (wheel.spent && t - wheel.at > 450 && size > Math.max(30, wheel.floor * 3));
      if (fresh) Object.assign(wheel, { sum: 0, spent: false, own: scrollsItself(event) });
      wheel.last = t;
      wheel.floor = Math.min(wheel.floor, size);
      if (wheel.own) return pause();
      event.preventDefault();
      event.stopPropagation();
      if (wheel.spent || t - wheel.at < 250 || !stage.ready) return;
      wheel.sum += delta;
      if (Math.abs(wheel.sum) < 12) return; // the last crumbs of a glide are not a gesture
      Object.assign(wheel, { spent: true, at: t, floor: Infinity });
      pause();
      step(Math.sign(wheel.sum));
    },
    { passive: false, capture: true },
  );

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const dir = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 }[event.key];
    if (!dir || !stage.ready || event.target.closest?.('input, textarea, select, pre')) return;
    // In a short window the panel scrolls: Page Up and Page Down are its keys first.
    const room = ui.panel.scrollHeight - ui.panel.clientHeight;
    if (event.key.startsWith('Page') && room > 1 && (dir > 0 ? ui.panel.scrollTop < room - 1 : ui.panel.scrollTop > 1)) return;
    event.preventDefault();
    pause();
    step(dir);
  });

  // Grabbing the book always works, even while the lens is flying somewhere.
  addEventListener(
    'pointerdown',
    (event) => {
      if (event.target !== ui.scene) return;
      pause();
      stage.release();
    },
    { capture: true },
  );
  stage.onGrab = pause;
}

async function boot() {
  if (!webgl2()) return;
  root.classList.add('has-scene');
  buildPins();

  let assets, createStage;
  try {
    [assets, { createStage }] = await Promise.all([loadAssets(), import('./scene/stage.js')]);
    stage = createStage(ui.scene, assets, { reducedMotion });
  } catch (error) {
    console.error(error);
    root.classList.remove('has-scene');
    return;
  }

  const resize = () => {
    stage.resize(innerWidth, innerHeight, Math.min(devicePixelRatio, 1.75));
    measure();
  };
  addEventListener('resize', resize);
  new ResizeObserver(measure).observe(ui.panel);

  stage.onFrame = placePins;
  stage.onLevels = (levels) => {
    for (const p of pins) {
      if (!p.site) continue;
      $('i', p.el).style.setProperty('--c', LEVEL_COLOURS[levels[p.site]]);
      const signalledHere = p.site === 'lauvitel' && staged.signal;
      $('small', p.el).textContent = signalledHere ? 'Saturé, signalé' : LEVELS[levels[p.site]].name;
    }
  };
  // The tour starts by itself once the book is open, unless the reader already
  // chose a page, touched something, or asked for less motion.
  const linked = location.hash.length > 1;
  stage.onReady = () => {
    if (!reducedMotion && !linked && !auto.declined) play({ now: false });
  };

  stage.setPartner(PARTNERS.find((p) => p.id === START.partner));
  resize();
  jump(location.hash.slice(1), { instant: true });
  steer();
  stage.start();
  root.classList.add('is-live');

  addEventListener('hashchange', () => {
    pause();
    jump(location.hash.slice(1));
  });
  if (import.meta.env.DEV) Object.assign(window, { stage, tour: { step, jump, play, pause, shown, staged, get beat() { return beat; }, get on() { return auto.on; } } });
}

panel.hour(START.hour);
boot();
