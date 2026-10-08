/**
 * The music corner left of the claw machine: the bedroom hi-fi of Dennis's reference (hifi.ts, its pieces Tripo
 * models in public/models/hifi-v1.glb), playing memoryrot's album. Dennis, 2026-10-06: a CD player with the disc visible on top; "clicking the cd player zooms in on
 * the top, and you can use skeuomorphic buttons on the cd player to change song and play the cd - the cd is the album
 * cover and you can see it spin", and a menu "where you can pick the songs and play them right there"; then "a radio
 * that looks like the left one here built", with its table, speakers, cases and remote.
 *
 * Here: the behaviour. In the hall a real button over the corner opens it (the hall moves the camera onto the unit,
 * hallScene.ts); then six key twins lie over the four keys and the knob's two halves for focus and screen readers, and
 * the track list sits beside the unit. The keys press in, the knob turns with the volume, the disc turns while the
 * album plays, the display shows digits and symbols only. Playback is albumPlayer's, outside the scene.
 */
import * as THREE from 'three';
import { album, clock } from '../../lib/album';
import { albumPlayer, VOLUME_STEPS } from '../../lib/albumPlayer';
import { copy } from '../../lib/i18n';
import { buildHifi, HIFI_SCALE, type HifiAct, type HifiKey } from './hifi';

/** Relative to the claw machine's station: left of it, back by the wall (Dennis, 2026-10-07: "the table further to
 * the wall placed"), its back edge about 9 cm from the bricks, turned a little to the room. */
export const CD_PLACE = { x: -1.55, z: -1.15, rotY: 0.1 };

/** Turns per second of the disc while it plays: slow enough that the cover still reads (a real CD would strobe). */
const SPIN = 0.75;
const BARS = 12;
/** The knob's travel from silent to full, as on the era's dials (radians either side of top). */
const KNOB_SWEEP = 2.35;
const SEGMENTS: Record<string, string> = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
const ALBUM_LENGTH = clock(album.tracks.reduce((sum, track) => sum + track.seconds, 0));

/** Accessible names of the controls, for Dennis's veto (they are read, not shown). */
const KEY_NAMES: Record<HifiAct, { de: string; en: string }> = {
  prev: { de: 'Vorheriger Titel', en: 'Previous track' },
  play: { de: 'Abspielen / Pause', en: 'Play / pause' },
  stop: { de: 'Stopp', en: 'Stop' },
  next: { de: 'Nächster Titel', en: 'Next track' },
  quieter: { de: 'Leiser', en: 'Volume down' },
  louder: { de: 'Lauter', en: 'Volume up' },
};

type Key = HifiKey & { press: number; down: boolean; hover: boolean; twin?: HTMLButtonElement };

const bi = (de: string, en: string) => `<span data-lang="de">${de}</span><span data-lang="en">${en}</span>`;
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export class HallCdPlayer {
  readonly group = new THREE.Group();
  private disc: THREE.Mesh;
  private knob: THREE.Object3D;
  private keys: Key[];
  private screen: { ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture; width: number; height: number };
  private view: { centre: THREE.Vector3; dir: THREE.Vector3; radius: number };
  private owned: { dispose(): void }[];
  private angle = 0;
  private spin = 0;
  private knobAngle: number;
  private updatedAt = 0;
  private drawn = '';
  private drawnAt = 0;
  private bars = new Float32Array(BARS);
  private volumeShownUntil = 0;
  private lastVolume = albumPlayer.volume;
  private bounds = new THREE.Sphere();
  private localBox: THREE.Box3;
  private unsubscribe: () => void;
  private open = false;
  private progressAt = 0;
  /** DOM: the hall's button, the key twins and the track list (appended by the hall). */
  readonly dom: HTMLElement;
  private twin: HTMLButtonElement;
  private menu: HTMLElement;
  private placed = '';
  private menuAt = '';
  /** Focus that waits for its element to show (see focusInside, setOpen). */
  private focusNext: HTMLElement | null = null;
  private keyboard = false;

  constructor(model: THREE.Object3D, private opts: { reduce: boolean; wallZ: number; onChange: () => void; onOpen: (keyboard: boolean) => void; onClose: () => void }) {
    // the hall's wall in the corner's space: turned by CD_PLACE.rotY, scaled by HIFI_SCALE (for the mains socket)
    const turn = CD_PLACE.rotY, wall = (opts.wallZ - CD_PLACE.z) / HIFI_SCALE;
    const hifi = buildHifi(model, album.cover, () => opts.onChange(), { z: (x) => (wall + x * Math.sin(turn)) / Math.cos(turn), turn: -turn });
    this.group.name = 'music-corner';
    hifi.group.scale.setScalar(HIFI_SCALE);
    this.group.add(hifi.group);
    this.disc = hifi.disc;
    this.knob = hifi.knob;
    this.screen = hifi.screen;
    this.view = hifi.view;
    this.owned = hifi.owned;
    this.keys = hifi.keys.map((key) => ({ ...key, press: 0, down: false, hover: false }));
    this.knobAngle = this.knobGoal();
    this.knob.rotation.z = this.knobAngle;
    this.group.updateMatrixWorld(true);
    this.localBox = new THREE.Box3().setFromObject(hifi.group, true);
    this.dom = document.createElement('div');
    this.dom.className = 'hall-cd-layer';
    this.twin = this.makeTwin();
    this.menu = this.makeMenu();
    this.keys.forEach((key, index) => { key.twin = this.makeKeyTwin(key, index); });
    this.dom.append(this.twin, ...this.keys.map((k) => k.twin!), this.menu);
    this.unsubscribe = albumPlayer.subscribe(() => this.changed());
    this.sync();
    this.drawScreen(0, true);
  }

  /* ---------- the hall's questions ---------- */

  /**
   * Which part a ray hits: a key (with its index; the knob by its half), the unit itself ('body'), or the rest of the
   * corner ('furniture': table, speakers, cases), which in the close-up counts as the room beside the player.
   */
  hit(raycaster: THREE.Raycaster): { part: 'key' | 'body' | 'furniture'; index: number; distance: number } | null {
    const hits = raycaster.intersectObject(this.group, true);
    if (!hits.length) return null;
    const distance = hits[0].distance;
    let o: THREE.Object3D | null = hits[0].object, unit = false;
    for (let p: THREE.Object3D | null = o; p && p !== this.group; p = p.parent) if (p.name === 'hifi-unit') unit = true;
    while (o && o.userData.key === undefined && !o.userData.knob && o !== this.group) o = o.parent;
    if (o?.userData.knob) {
      const local = o.worldToLocal(hits[0].point.clone());
      const index = this.keys.findIndex((k) => k.act === (local.x < 0 ? 'quieter' : 'louder'));
      return { part: 'key', index, distance };
    }
    const index = o?.userData.key as number | undefined;
    if (index !== undefined) return { part: 'key', index, distance };
    return { part: unit ? 'body' : 'furniture', index: -1, distance };
  }

  inView(frustum: THREE.Frustum) {
    // an empty Sphere has radius -1, not 0
    if (this.bounds.isEmpty()) {
      this.group.updateWorldMatrix(true, true);
      new THREE.Box3().setFromObject(this.group).getBoundingSphere(this.bounds);
    }
    return frustum.intersectsSphere(this.bounds);
  }

  /** The unit in world space: the close-up's centre, the direction it is seen from, and its radius. */
  lidWorld() {
    this.group.updateWorldMatrix(true, false);
    const m = this.group.children[0].matrixWorld;
    const centre = this.view.centre.clone().applyMatrix4(m);
    const normal = this.view.dir.clone().transformDirection(m);
    return { centre, normal, radius: this.view.radius * HIFI_SCALE };
  }

  get isOpen() { return this.open; }

  /** The camera arrived at (or left) the unit: the DOM follows the pose. */
  setOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    this.twin.setAttribute('aria-expanded', String(open));
    this.menu.hidden = !open;
    this.placed = '';
    if (!open) {
      for (const key of this.keys) { key.hover = key.down = false; this.tintKey(key); }
      // Focus inside the player (or dropped when its button hid behind a keyboard opening) goes back to that button.
      const active = document.activeElement;
      if (active !== this.twin && (this.dom.contains(active) || (this.keyboard && (!active || active === document.body)))) this.focusNext = this.twin;
      this.keyboard = false;
    }
    this.sync();
  }

  /**
   * Moves focus into the open player: its play key (keyboard openings only; a pointer keeps its own focus). The key's
   * twin shows once the hall has placed it, so the focus waits for that (place()).
   */
  focusInside() {
    this.keyboard = true;
    this.focusNext = this.keys.find((k) => k.act === 'play')?.twin ?? null;
  }

  /** The track list's box, for the close-up's layout (read once per opening and resize). */
  menuRect() { return this.menu.hidden ? null : this.menu.getBoundingClientRect(); }

  /** The close-up puts the track list just right of the unit: its left edge and vertical centre, in the hall's pixels. */
  placeMenu(left: number, centre: number) {
    const key = `${Math.round(left)},${Math.round(centre)}`;
    if (key === this.menuAt) return;
    this.menuAt = key;
    this.menu.style.left = `${Math.round(left)}px`;
    this.menu.style.top = `${Math.round(centre)}px`;
    this.menu.style.right = 'auto';
  }

  /**
   * Places the DOM over the picture: in the hall pose the twin over the corner's projected box, in the close-up the
   * key twins over the controls. Hidden whenever its part is off screen, so there is never an invisible tab stop.
   */
  place(camera: THREE.Camera, width: number, height: number, mode: 'hall' | 'open' | 'none') {
    this.placeParts(camera, width, height, mode);
    if (this.focusNext && !this.focusNext.hidden && this.focusNext.isConnected) {
      this.focusNext.focus({ preventScroll: true });
      this.focusNext = null;
    }
  }

  private placeParts(camera: THREE.Camera, width: number, height: number, mode: 'hall' | 'open' | 'none') {
    const parts: string[] = [mode];
    let box: { x: number; y: number; w: number; h: number } | null = null;
    if (mode === 'hall') {
      box = this.screenBox(camera, width, height);
      if (box) parts.push(`${box.x | 0},${box.y | 0},${box.w | 0},${box.h | 0}`);
    }
    const keyBoxes = mode === 'open' ? this.keys.map((key) => this.keyBox(key, camera, width, height)) : [];
    for (const k of keyBoxes) parts.push(k ? `${k.x | 0},${k.y | 0},${k.d | 0}` : '-');
    const sig = parts.join('|');
    if (sig === this.placed) return;
    this.placed = sig;
    this.twin.hidden = !box;
    if (box) {
      // at least 44 x 44 px around the corner's centre, however far the camera stands
      const w = Math.round(Math.max(44, box.w)), h = Math.round(Math.max(44, box.h));
      this.twin.style.transform = `translate(${Math.round(box.x + box.w / 2 - w / 2)}px, ${Math.round(box.y + box.h / 2 - h / 2)}px)`;
      this.twin.style.width = `${w}px`;
      this.twin.style.height = `${h}px`;
    }
    this.keys.forEach((key, i) => {
      const k = keyBoxes[i];
      const twin = key.twin!;
      twin.hidden = !k;
      if (!k) return;
      const d = Math.round(Math.max(32, k.d));
      twin.style.transform = `translate(${Math.round(k.x - d / 2)}px, ${Math.round(k.y - d / 2)}px)`;
      twin.style.width = twin.style.height = `${d}px`;
    });
  }

  /** A click on the canvas landed on a key (the twins usually take it first). */
  pressKey(index: number) {
    const key = this.keys[index];
    if (!key) return;
    key.press = 1;
    this.act(key.act);
    this.opts.onChange();
  }

  setReduce(reduce: boolean) { this.opts.reduce = reduce; }

  /**
   * Advances the disc, the keys, the knob and the display. Returns true while something visible changes; `visible`
   * false (off camera) keeps the music going but skips the drawing.
   */
  update(now: number, visible: boolean): boolean {
    const dt = this.updatedAt ? Math.min(0.1, (now - this.updatedAt) / 1000) : 0;
    this.updatedAt = now;
    let moving = false;
    const playing = albumPlayer.state === 'playing';
    const target = playing && !this.opts.reduce ? SPIN : 0;
    this.spin += (target - this.spin) * (1 - Math.exp(-dt * (target > this.spin ? 1.8 : 1.1)));
    if (target === 0 && this.spin < 0.004) this.spin = 0;
    if (this.spin > 0) {
      // clockwise seen from above, as a CD turns under its lid
      this.angle = (this.angle + this.spin * Math.PI * 2 * dt) % (Math.PI * 2);
      this.disc.rotation.y = -this.angle;
      moving = true;
    }
    for (const key of this.keys) {
      if (!key.travel) continue;
      const goal = key.down ? 1 : 0;
      // a press always reaches the bottom before it springs back
      if (key.press > 0) { key.press = Math.max(0, key.press - dt / 0.11); }
      const depth = this.opts.reduce ? (key.down || key.press > 0 ? 1 : 0) : Math.max(goal, key.press > 0 ? Math.min(1, (1 - key.press) * 3.5 + 0.2) : 0);
      const z = -key.travel * depth;
      if (Math.abs(key.cap.position.z - z) > 1e-6) {
        key.cap.position.z += (z - key.cap.position.z) * (this.opts.reduce ? 1 : 1 - Math.exp(-dt * 38));
        if (Math.abs(key.cap.position.z - z) < 1e-6) key.cap.position.z = z;
        moving = true;
      }
    }
    // the knob turns to the volume
    const knobGoal = this.knobGoal();
    if (Math.abs(this.knobAngle - knobGoal) > 1e-4) {
      this.knobAngle += (knobGoal - this.knobAngle) * (this.opts.reduce ? 1 : 1 - Math.exp(-dt * 14));
      if (Math.abs(this.knobAngle - knobGoal) < 1e-4) this.knobAngle = knobGoal;
      this.knob.rotation.z = this.knobAngle;
      moving = true;
    }
    if (albumPlayer.volume !== this.lastVolume) {
      this.lastVolume = albumPlayer.volume;
      this.volumeShownUntil = now + 1400;
    }
    if (visible && this.drawScreen(now)) moving = true;
    if (this.open && now - this.progressAt > 250) {
      this.progressAt = now;
      this.syncProgress();
    }
    return visible && moving;
  }

  dispose() {
    this.unsubscribe();
    this.dom.remove();
    this.owned.forEach((resource) => resource.dispose());
  }

  /* ---------- playback ---------- */

  /** Turned clockwise as the volume rises, from KNOB_SWEEP left of top to as far right. */
  private knobGoal() { return KNOB_SWEEP - (albumPlayer.volume / VOLUME_STEPS) * 2 * KNOB_SWEEP; }

  private act(act: HifiAct) {
    if (albumPlayer.failed) {
      if (act === 'play') window.open(album.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (act === 'play') albumPlayer.toggle();
    else if (act === 'next') albumPlayer.next();
    else if (act === 'prev') albumPlayer.prev();
    else if (act === 'stop') albumPlayer.stop();
    else if (act === 'louder') albumPlayer.louder();
    else albumPlayer.quieter();
  }

  private changed() {
    this.sync();
    this.opts.onChange();
  }

  /** Labels, pressed states and the current track follow the player. */
  private sync() {
    const state = albumPlayer.state;
    const playing = state === 'playing';
    this.keys.find((k) => k.act === 'play')?.twin?.setAttribute('aria-pressed', String(playing));
    const now = this.twin.querySelector('.hall-cd__now');
    if (now) now.textContent = state === 'stopped' ? '' : `${playing ? '▶' : '❚❚'} ${String(albumPlayer.track + 1).padStart(2, '0')} ${album.tracks[albumPlayer.track].title}`;
    this.menu.dataset.state = state;
    this.menu.toggleAttribute('data-failed', albumPlayer.failed);
    this.menu.querySelectorAll<HTMLButtonElement>('[data-track]').forEach((row) => {
      const current = Number(row.dataset.track) === albumPlayer.track;
      if (current) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    });
    this.syncProgress();
  }

  private syncProgress() {
    const row = this.menu.querySelector<HTMLElement>('[data-track][aria-current] .hall-cd-menu__bar');
    const track = album.tracks[albumPlayer.track];
    const value = albumPlayer.state === 'stopped' ? 0 : Math.min(1, albumPlayer.elapsed / track.seconds);
    this.menu.querySelectorAll<HTMLElement>('.hall-cd-menu__bar').forEach((bar) => { if (bar !== row) bar.style.removeProperty('--progress'); });
    row?.style.setProperty('--progress', value.toFixed(4));
  }

  /* ---------- DOM ---------- */

  private makeTwin() {
    const twin = document.createElement('button');
    twin.type = 'button';
    twin.className = 'hall-cd';
    twin.hidden = true;
    twin.setAttribute('aria-expanded', 'false');
    twin.innerHTML = `<span class="hall-cd__hint"><strong>${escapeHtml(album.artist)}</strong><span>${escapeHtml(album.title)}</span><span class="hall-cd__now"></span></span>`;
    // Enter and Space arrive as clicks with detail 0: those moved focus into the player, a pointer keeps its own.
    twin.addEventListener('click', (event) => this.opts.onOpen(event.detail === 0));
    return twin;
  }

  private makeMenu() {
    const menu = document.createElement('section');
    menu.className = 'hall-cd-menu';
    menu.hidden = true;
    menu.setAttribute('aria-label', `${album.artist} – ${album.title}`);
    const rows = album.tracks.map((track, i) => `<li><button type="button" class="hall-cd-menu__track" data-track="${i}"><span class="hall-cd-menu__n">${String(i + 1).padStart(2, '0')}</span><span class="hall-cd-menu__title">${escapeHtml(track.title)}</span><span class="hall-cd-menu__eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="hall-cd-menu__time">${clock(track.seconds)}</span><span class="hall-cd-menu__bar" aria-hidden="true"></span></button></li>`).join('');
    menu.innerHTML = `
      <header class="hall-cd-menu__head">
        <img class="hall-cd-menu__cover" src="${album.cover}" alt="" width="56" height="56" decoding="async">
        <p class="hall-cd-menu__album"><strong>${escapeHtml(album.artist)}</strong><span>${escapeHtml(album.title)}</span></p>
        <button type="button" class="hall-cd-menu__close"><span aria-hidden="true">×</span><span class="sr-only">${bi(copy.de.panel.close, copy.en.panel.close)}</span></button>
      </header>
      <ol class="hall-cd-menu__tracks">${rows}</ol>
      <footer class="hall-cd-menu__foot">
        <a class="hall-cd-menu__spotify" href="${album.url}" target="_blank" rel="noopener noreferrer">${bi('Auf Spotify hören', 'Listen on Spotify')}<span aria-hidden="true">↗</span></a>
        <span class="hall-cd-menu__esc" aria-hidden="true">Esc ${bi('Halle', 'hall')}</span>
      </footer>`;
    menu.querySelector('img')?.addEventListener('error', (event) => (event.currentTarget as HTMLElement).remove());
    menu.querySelector('.hall-cd-menu__close')?.addEventListener('click', () => this.opts.onClose());
    menu.querySelectorAll<HTMLButtonElement>('[data-track]').forEach((row) => row.addEventListener('click', () => {
      const index = Number(row.dataset.track);
      if (albumPlayer.failed) { window.open(album.url, '_blank', 'noopener,noreferrer'); return; }
      if (index === albumPlayer.track && albumPlayer.state !== 'stopped') albumPlayer.toggle();
      else albumPlayer.play(index);
      // the play key under the finger goes down too
      const play = this.keys.find((k) => k.act === 'play');
      if (play) play.press = 1;
      this.opts.onChange();
    }));
    return menu;
  }

  private makeKeyTwin(key: Key, index: number) {
    const twin = document.createElement('button');
    twin.type = 'button';
    twin.className = 'hall-cd-key';
    twin.hidden = true;
    twin.dataset.act = key.act;
    twin.innerHTML = `<span class="sr-only">${bi(KEY_NAMES[key.act].de, KEY_NAMES[key.act].en)}</span>`;
    const hover = (on: boolean) => { key.hover = on; if (!on) key.down = false; this.tintKey(key); this.opts.onChange(); };
    twin.addEventListener('pointerenter', () => hover(true));
    twin.addEventListener('pointerleave', () => hover(false));
    twin.addEventListener('focus', () => hover(true));
    twin.addEventListener('blur', () => hover(false));
    twin.addEventListener('pointerdown', () => { key.down = true; this.opts.onChange(); });
    twin.addEventListener('pointerup', () => { key.down = false; this.opts.onChange(); });
    twin.addEventListener('click', () => this.pressKey(index));
    return twin;
  }

  /** A faint violet glow under the pointer or focus; the knob's halves share the knob. */
  private tintKey(key: Key) {
    const lit = this.keys.some((k) => k.material === key.material && k.hover);
    key.material.emissiveIntensity = lit ? 0.55 : 0;
  }

  private screenBox(camera: THREE.Camera, width: number, height: number) {
    const b = this.localBox, v = new THREE.Vector3();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      v.set(x, y, z).applyMatrix4(this.group.matrixWorld).project(camera);
      if (v.z > 1) return null;
      const px = (v.x + 1) / 2 * width, py = (1 - v.y) / 2 * height;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    if (x1 < 0 || y1 < 0 || x0 > width || y0 > height || x1 - x0 < 8) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  private keyBox(key: Key, camera: THREE.Camera, width: number, height: number) {
    // the face of a key, or the knob's face; its half for the knob's two twins
    const c = new THREE.Vector3(key.hit.x, key.hit.y, key.face).applyMatrix4(key.group.matrixWorld).project(camera);
    const e = new THREE.Vector3(key.hit.x + key.hit.r, key.hit.y, key.face).applyMatrix4(key.group.matrixWorld).project(camera);
    if (c.z > 1) return null;
    const x = (c.x + 1) / 2 * width, y = (1 - c.y) / 2 * height;
    const d = 2 * Math.hypot((e.x - c.x) / 2 * width, (e.y - c.y) / 2 * height) * (key.travel ? 1.3 : 1.05);
    if (x < 0 || y < 0 || x > width || y > height) return null;
    return { x, y, d };
  }

  /* ---------- the display ---------- */

  /** Redraws when what it shows changed; at most 30 times a second while the spectrum moves. */
  private drawScreen(now: number, force = false) {
    const state = albumPlayer.state;
    const playing = state === 'playing';
    if (!force && playing && now - this.drawnAt < 33) return false;
    const blink = state === 'paused' && Math.floor(now / 500) % 2 === 1;
    const volume = now < this.volumeShownUntil;
    if (playing && !this.opts.reduce) albumPlayer.spectrum(this.bars);
    else this.bars.fill(0);
    const levels = Array.from(this.bars, (v) => Math.round(Math.min(1, Math.max(0, (v - 0.18) / 0.62)) * 5));
    const failed = albumPlayer.failed;
    const digits = failed ? '--' : state === 'stopped' ? String(album.tracks.length).padStart(2, '0') : String(albumPlayer.track + 1).padStart(2, '0');
    const time = failed ? '-:--' : volume ? String(albumPlayer.volume).padStart(2, ' ') : state === 'stopped' ? ALBUM_LENGTH : clock(albumPlayer.elapsed);
    const key = `${state}|${digits}|${blink ? '' : time}|${volume}|${levels.join('')}`;
    if (!force && key === this.drawn) return false;
    this.drawn = key;
    this.drawnAt = now;
    const { ctx, texture, width: W, height: H } = this.screen;
    // the segments only, on a clear ground: the backlight behind them and the pane in front are layers of their own (hifi.ts)
    ctx.clearRect(0, 0, W, H);
    const x0 = 5, y0 = 5, x1 = W - 5, y1 = H - 5;
    ctx.save();
    const ink = '#0c1f4d', ghost = 'rgba(12,31,77,.08)';
    const top = y0 + 26, h = 62;
    this.drawDigits(digits, x0 + 16, top, h, ink, ghost);
    const iconX = x0 + 100, mid = top + h / 2;
    ctx.fillStyle = ink;
    if (state === 'playing') { ctx.beginPath(); ctx.moveTo(iconX, mid - 12); ctx.lineTo(iconX + 20, mid); ctx.lineTo(iconX, mid + 12); ctx.closePath(); ctx.fill(); }
    else if (state === 'paused') { ctx.fillRect(iconX, mid - 12, 7, 24); ctx.fillRect(iconX + 13, mid - 12, 7, 24); }
    else ctx.fillRect(iconX + 1, mid - 10, 20, 20);
    const timeW = time.length * 38 - 8;
    const timeX = x1 - 18 - timeW;
    const barsX0 = iconX + 40, barsX1 = timeX - 22;
    if (volume) {
      ctx.beginPath();
      ctx.moveTo(barsX1 - 50, mid - 7); ctx.lineTo(barsX1 - 40, mid - 7); ctx.lineTo(barsX1 - 26, mid - 17); ctx.lineTo(barsX1 - 26, mid + 17); ctx.lineTo(barsX1 - 40, mid + 7); ctx.lineTo(barsX1 - 50, mid + 7);
      ctx.closePath(); ctx.fill();
      for (let i = 0; i < VOLUME_STEPS; i++) {
        ctx.fillStyle = i < albumPlayer.volume ? ink : ghost;
        const bh = 6 + i * 2.6;
        ctx.fillRect(barsX0 + i * 11, top + h - bh, 7, bh);
      }
    } else {
      const pitch = (barsX1 - barsX0 + 3) / BARS;
      for (let i = 0; i < BARS; i++) for (let s = 0; s < 5; s++) {
        ctx.fillStyle = s < levels[i] ? ink : ghost;
        ctx.fillRect(barsX0 + i * pitch, top + h - (s + 1) * 11.5 + 2, pitch - 3, 8.5);
      }
    }
    if (!blink) this.drawDigits(time, timeX, top, h, ink, ghost);
    else this.drawDigits(time.replace(/\d/g, ' '), timeX, top, h, ink, ghost);
    ctx.restore();
    texture.needsUpdate = true;
    return true;
  }

  /** Seven-segment digits in a slight italic, every segment faintly visible as on a real LCD; ':' is two dots. */
  private drawDigits(text: string, x: number, y: number, h: number, ink: string, ghost: string) {
    const ctx = this.screen.ctx, w = 30, t = 7;
    let cx = x;
    for (const ch of text) {
      if (ch === ':') {
        ctx.fillStyle = ink;
        ctx.fillRect(cx + 2, y + h * 0.28, 6, 6);
        ctx.fillRect(cx, y + h * 0.64, 6, 6);
        cx += 15;
        continue;
      }
      const on = SEGMENTS[ch] ?? '';
      for (const s of 'abcdefg') {
        ctx.fillStyle = on.includes(s) ? ink : ghost;
        this.segment(s, cx, y, w, h, t);
      }
      cx += 38;
    }
  }

  private segment(s: string, x: number, y: number, w: number, h: number, t: number) {
    const ctx = this.screen.ctx, half = t / 2, gap = 1.3, slant = 0.11;
    const p = (px: number, py: number): [number, number] => [px + (y + h - py) * slant, py];
    const bar = (ax: number, ay: number, bx: number, by: number) => {
      const horizontal = ay === by;
      const pts: [number, number][] = horizontal
        ? [[ax + gap, ay], [ax + gap + half, ay - half], [bx - gap - half, ay - half], [bx - gap, ay], [bx - gap - half, ay + half], [ax + gap + half, ay + half]]
        : [[ax, ay + gap], [ax + half, ay + gap + half], [ax + half, by - gap - half], [ax, by - gap], [ax - half, by - gap - half], [ax - half, ay + gap + half]];
      ctx.beginPath();
      pts.forEach(([px, py], i) => { const [qx, qy] = p(px, py); if (i) ctx.lineTo(qx, qy); else ctx.moveTo(qx, qy); });
      ctx.closePath();
      ctx.fill();
    };
    const l = x + half, r = x + w - half, top = y + half, mid = y + h / 2, bottom = y + h - half;
    if (s === 'a') bar(l, top, r, top);
    else if (s === 'b') bar(r, top, r, mid);
    else if (s === 'c') bar(r, mid, r, bottom);
    else if (s === 'd') bar(l, bottom, r, bottom);
    else if (s === 'e') bar(l, mid, l, bottom);
    else if (s === 'f') bar(l, top, l, mid);
    else bar(l, mid, r, mid);
  }
}
