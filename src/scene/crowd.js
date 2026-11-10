import * as THREE from 'three';
import { paperGeometry, paperMaterial } from './paper.js';
import { SLOTS, CHEMIN } from './layout.js';
import { rng } from './scenery.js';

const CAST = [['chapeau', 0.6, 0.4], ['canne', 0.64, 0.2], ['chien', 0.56, 0.22], ['fauteuil', 0.7, 0.18]];
const MOODS = { content: '', surpris: '-surpris', fatigue: '-fatigue' };
const LEAN = 0.1;

/**
 * The visitors: small card figurines of the four Éclaireurs. Each site holds
 * as many as its level calls for; their faces follow the level, the way the
 * product's own illustrations do (content, surpris, fatigué).
 */
export class Crowd {
  constructor(parent, svgs) {
    this.parent = parent;
    this.random = rng(101);
    this.geo = {};
    for (const [id, height] of CAST) {
      this.geo[id] = {};
      for (const [mood, suffix] of Object.entries(MOODS)) {
        this.geo[id][mood] = paperGeometry(svgs[`eclaireur-${id}${suffix}`], { height, detail: 5, gap: 0.003 });
      }
    }
    this.sites = {};
    for (const [id, slots] of Object.entries(SLOTS)) {
      this.sites[id] = { id, slots: slots.map((s) => ({ ...s, taken: null })), members: [], target: 0, mood: 'content', clock: 0 };
    }
    this.pool = [];
    this.all = [];
    this.onArrive = null;
  }

  pick() {
    let roll = this.random();
    for (const [id, , share] of CAST) {
      if ((roll -= share) <= 0) return id;
    }
    return 'chapeau';
  }

  figurine() {
    let f = this.pool.pop();
    if (!f) {
      const sheet = new THREE.Mesh(this.geo.chapeau.content, paperMaterial());
      sheet.castShadow = sheet.receiveShadow = true;
      const pivot = new THREE.Group();
      pivot.add(sheet);
      this.parent.add(pivot);
      f = { pivot, sheet };
      this.all.push(f);
    }
    f.char = this.pick();
    f.phase = this.random() * 6.28;
    f.value = 0;
    f.speed = 0;
    f.stand = 1;
    f.wait = 0;
    f.travel = null;
    f.pivot.visible = true;
    return f;
  }

  dress(f, mood) {
    f.mood = mood;
    f.sheet.geometry = this.geo[f.char][mood];
  }

  freeSlot(site) {
    return site.slots.find((s) => !s.taken);
  }

  place(f, slot) {
    slot.taken = f;
    f.slot = slot;
    f.pivot.position.set(slot.x, 0.004, slot.z);
    f.pivot.rotation.set(0, slot.turn, 0);
    f.sheet.scale.setScalar(slot.size);
  }

  setTarget(id, count) {
    const site = this.sites[id];
    site.target = Math.min(count, site.slots.length);
  }

  setMood(id, mood) {
    const site = this.sites[id];
    if (site.mood === mood) return;
    site.mood = mood;
    for (const f of site.members) f.redress = 0.05 + this.random() * 0.6;
  }

  count(id) {
    return this.sites[id].members.filter((f) => f.stand === 1).length;
  }

  /** Sends up to `n` figurines from one site to another along the printed path. */
  move(fromId, toId, n, reverse = false) {
    const from = this.sites[fromId], to = this.sites[toId];
    const movers = from.members
      .filter((f) => f.stand === 1 && !f.travel)
      .sort((a, b) => (reverse ? a.slot.x - b.slot.x : b.slot.x - a.slot.x))
      .slice(0, n);
    const way = reverse ? [...CHEMIN].reverse() : CHEMIN;
    movers.forEach((f, i) => {
      const slot = this.freeSlot(to);
      if (!slot) return;
      from.members.splice(from.members.indexOf(f), 1);
      f.slot.taken = null;
      const start = f.pivot.position.clone();
      slot.taken = f;
      f.slot = slot;
      to.members.push(f);
      const points = [start, ...way.map(([x, z]) => new THREE.Vector3(x + (this.random() - 0.5) * 0.3, 0.004, z + (this.random() - 0.5) * 0.3)), new THREE.Vector3(slot.x, 0.004, slot.z)];
      f.travel = { curve: new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4), u: 0, wait: i * 0.085 + this.random() * 0.05, time: 2.5 + this.random() * 0.5, hops: 9 + Math.floor(this.random() * 3), site: to };
    });
    return movers.length;
  }

  /** Puts every site at its target at once (no animation). */
  settle() {
    for (const site of Object.values(this.sites)) {
      // Reconcile both directions before freezing the crowd. No future frame
      // is needed to fold visitors away or finish a change of expression.
      for (const f of site.members.splice(site.target)) {
        f.pivot.visible = false;
        f.slot.taken = null;
        f.stand = 0;
        f.travel = null;
        f.redress = undefined;
        this.pool.push(f);
      }
      while (site.members.length < site.target) {
        const slot = this.freeSlot(site);
        if (!slot) break;
        const f = this.figurine();
        this.dress(f, site.mood);
        this.place(f, slot);
        site.members.push(f);
      }
      for (const f of site.members) {
        this.place(f, f.slot);
        this.dress(f, site.mood);
        f.stand = f.value = 1;
        f.speed = 0;
        f.travel = null;
        f.redress = undefined;
        f.sheet.rotation.set(-LEAN, 0, 0);
        f.sheet.position.y = 0;
      }
    }
  }

  update(t, dt) {
    for (const site of Object.values(this.sites)) {
      site.clock -= dt;
      const standing = site.members.filter((f) => f.stand === 1);
      if (site.clock <= 0 && standing.length < site.target) {
        const slot = this.freeSlot(site);
        if (slot) {
          const f = this.figurine();
          this.dress(f, site.mood);
          this.place(f, slot);
          site.members.push(f);
          site.clock = 0.028;
        }
      } else if (site.clock <= 0 && standing.length > site.target) {
        const idle = standing.filter((f) => !f.travel).sort((a, b) => a.slot.rank - b.slot.rank);
        const f = idle[idle.length - 1];
        if (f) {
          f.stand = 0;
          site.clock = 0.022;
        }
      }
    }

    for (const f of this.all) {
      if (!f.pivot.visible) continue;

      // Stand up or fold down, on a spring.
      const d = f.stand - f.value;
      f.speed += (d * 150 - f.speed * 14) * dt;
      f.value += f.speed * dt;
      if (f.stand === 0 && f.value < 0.03) {
        f.pivot.visible = false;
        f.slot.taken = null;
        for (const site of Object.values(this.sites)) {
          const i = site.members.indexOf(f);
          if (i >= 0) site.members.splice(i, 1);
        }
        this.pool.push(f);
        continue;
      }
      f.sheet.rotation.x = (-Math.PI / 2) * (1 - f.value) - LEAN * f.value;

      if (f.redress !== undefined) {
        f.redress -= dt;
        if (f.redress <= 0) {
          f.redress = undefined;
          const site = Object.values(this.sites).find((s) => s.members.includes(f));
          if (site) this.dress(f, site.mood);
          f.speed += 2.2;
        }
      }

      let sway = Math.sin(t * (f.mood === 'fatigue' ? 2.6 : 1.5) + f.phase) * (f.mood === 'content' ? 0.035 : 0.055);
      let lift = 0;
      const tr = f.travel;
      if (tr) {
        if (tr.wait > 0) tr.wait -= dt;
        else {
          tr.u = Math.min(1, tr.u + dt / tr.time);
          const e = tr.u * tr.u * (3 - 2 * tr.u);
          tr.curve.getPoint(e, f.pivot.position);
          lift = Math.abs(Math.sin(e * Math.PI * tr.hops)) * 0.3;
          sway = Math.sin(e * Math.PI * tr.hops * 2) * 0.16;
          f.pivot.rotation.y += (0 - f.pivot.rotation.y) * Math.min(1, dt * 6);
          if (tr.u >= 1) {
            f.travel = null;
            f.pivot.rotation.y = f.slot.turn;
            f.sheet.scale.setScalar(f.slot.size);
            this.dress(f, tr.site.mood);
            f.speed += 2.4;
            this.onArrive?.(f.pivot.position);
          }
        }
      }
      f.sheet.position.y = lift;
      f.sheet.rotation.z = sway;
    }
  }
}
