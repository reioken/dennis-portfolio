/**
 * The CD player left of the claw machine (Dennis, 2026-10-05: a model "next to the claw machine on the left where you
 * can play my music", an "early 2000s cd player, kinda silver"). Concept from Gemini (Nano Banana Pro, through Meshy),
 * model from Meshy image-to-3D, prepared by scripts/models/boombox-build.mjs. It stands on a road case in front of the
 * painted Breakout, turned a little toward the room. The front-loading disc window is what makes it a CD player from
 * the hall's eye-height camera; a lid on top would be edge-on.
 *
 * A click on the player starts, pauses and resumes memoryrot's album (src/lib/album.ts); a click on the disc window
 * skips to the next track. While it plays the disc turns, the display shows the track, a small spectrum and the time,
 * and the violet speaker trims pulse with the bass (Web Audio analyser). Stopped, the display shows what a CD player
 * shows with a disc in: the track count and the album's length. Digits and symbols only, no words. As long as the
 * audio is not hosted on the site (album.selfHosted), a click opens the album on Spotify instead.
 * With reduced motion the disc stands still, the spectrum stays dark and the trims hold one level.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { album } from '../../lib/album';

export const BOOMBOX_MODEL = '/models/boombox-v1.glb.gz?v=697b47e9';
/** Relative to the claw machine's station: left of it, in front of the cabinet line, turned toward the room. */
export const BOOMBOX_PLACE = { x: -1.32, z: 0.3, rotY: 0.24 };

/** On the prepared model, in metres: the disc's centre height on the front and its radius (boombox-build.mjs). */
const DISC = { y: 0.1331, r: 0.072 };
/** The road case under the player. */
const CASE = { w: 0.7, h: 0.44, d: 0.42 };
/** Turns per second of the disc while playing (slower than a real CD: at 60 frames a real one would strobe). */
const SPIN = 1.6;
const TRIM = { color: 0x7d6cff, idle: 0.32 };
const BARS = 14;
const CANVAS = { w: 512, h: 128 };
/** The display strip inside its overlay's UV square (DISPLAY plus its margin in boombox-build.mjs), in canvas pixels. */
const STRIP = { x0: 33, x1: 479, y0: 35, y1: 93 };
const SEGMENTS: Record<string, string> = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' };

type State = 'stopped' | 'playing' | 'paused';
export type BoomboxPart = 'disc' | 'body';

const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const ALBUM_LENGTH = clock(album.tracks.reduce((sum, track) => sum + track.seconds, 0));

export class HallBoombox {
  readonly group = new THREE.Group();
  private player: THREE.Object3D;
  private body?: THREE.MeshStandardMaterial;
  private screen: { ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture };
  private discMaps: THREE.Texture[] = [];
  private owned: { dispose(): void }[] = [];
  private audio?: HTMLAudioElement;
  private context?: AudioContext;
  private analyser?: AnalyserNode;
  private bins?: Uint8Array<ArrayBuffer>;
  private state: State = 'stopped';
  private track = 0;
  private failed = false;
  private angle = 0;
  private spin = 0;
  private envelope = 0;
  private bassLevel = 0;
  private bars = new Float32Array(BARS);
  private drawn = '';
  private drawnAt = 0;
  private updatedAt = 0;
  private bounds = new THREE.Sphere();
  private twin?: HTMLElement;
  /** The player's box in the group's own space, taken before the hall places the group. */
  private localBox: THREE.Box3;
  private disposed = false;

  constructor(model: THREE.Object3D, private opts: { reduce: boolean; onChange: () => void }) {
    this.group.name = 'boombox';
    this.player = model;
    model.position.y = CASE.h;
    this.screen = this.makeScreen();
    const discMaterial = this.makeDisc();
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.name.startsWith('boombox_display')) {
        mesh.material = new THREE.MeshBasicMaterial({ map: this.screen.texture, alphaTest: 0.5, toneMapped: false, color: new THREE.Color(0.86, 0.86, 0.9) });
        this.owned.push(mesh.material);
      } else if (mesh.name.startsWith('boombox_disc')) {
        mesh.material = discMaterial;
      } else {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        // Meshy's silver reads near-white under the cabinet lights: a little darker, a little less sky.
        mat.color.multiplyScalar(0.9);
        mat.envMapIntensity = 0.75;
        mat.emissive.set(TRIM.color);
        mat.emissiveIntensity = TRIM.idle;
        this.body = mat;
      }
    });
    this.group.add(model, ...this.makeCase());
    this.group.updateMatrixWorld(true);
    this.localBox = new THREE.Box3().setFromObject(model, true);
    this.drawScreen(0, true);
  }

  /**
   * The player's DOM twin, laid over its projected box by the hall: a real link (Spotify) or button (hosted audio)
   * for keyboard, screen readers and a visible focus ring, with a hint that says what a click does before it
   * happens. Its words are the About page's approved Spotify line plus the release's own artist and title. On touch,
   * where nothing hovers, the first tap shows the hint and the second one goes.
   */
  makeTwin(partAt?: (event: MouseEvent) => BoomboxPart): HTMLElement {
    const hosted = album.selfHosted && !this.failed;
    const twin = document.createElement(hosted ? 'button' : 'a');
    twin.className = 'hall-boombox';
    twin.hidden = true;
    const hint = document.createElement('span');
    hint.className = 'hall-boombox__hint';
    const artist = document.createElement('strong');
    artist.textContent = album.artist;
    const title = document.createElement('span');
    title.textContent = album.title;
    hint.append(artist, title);
    if (hosted) {
      const button = twin as HTMLButtonElement;
      button.type = 'button';
      button.setAttribute('aria-pressed', 'false');
      const track = document.createElement('span');
      track.className = 'hall-boombox__track';
      hint.append(track);
      // A pointer click keeps the disc window's skip (the hall raycasts where it landed); Enter and Space play or pause.
      button.addEventListener('click', (event) => this.press(event.detail === 0 ? 'body' : partAt?.(event) ?? 'body'));
    } else {
      const link = twin as HTMLAnchorElement;
      link.href = album.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const action = document.createElement('span');
      action.className = 'hall-boombox__action';
      action.innerHTML = '<span data-lang="de">Auf Spotify hören</span><span data-lang="en">Listen on Spotify</span><span aria-hidden="true">↗</span>';
      hint.append(action);
      let armedUntil = 0;
      link.addEventListener('click', (event) => {
        if (!matchMedia('(hover: none)').matches || performance.now() < armedUntil) return;
        event.preventDefault();
        armedUntil = performance.now() + 4000;
        link.dataset.armed = '';
        window.setTimeout(() => { delete link.dataset.armed; }, 4000);
      });
    }
    twin.append(hint);
    this.twin = twin;
    this.syncTwin();
    return twin;
  }

  /** The player's box on screen, in the container's pixels (the hall caches its size: no layout read). */
  screenBox(camera: THREE.Camera, width: number, height: number) {
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

  private syncTwin() {
    const twin = this.twin;
    if (!twin || twin.tagName !== 'BUTTON') return;
    twin.setAttribute('aria-pressed', String(this.state === 'playing'));
    const track = twin.querySelector('.hall-boombox__track');
    const current = album.tracks[this.track];
    if (track) track.textContent = this.state === 'stopped' ? '' : `${String(this.track + 1).padStart(2, '0')} ${current.title}`;
  }

  /** Which part of the player a ray hits (the case is furniture), or null. */
  hit(raycaster: THREE.Raycaster): { part: BoomboxPart; distance: number } | null {
    const hits = raycaster.intersectObject(this.player, true);
    if (!hits.length) return null;
    const local = this.player.worldToLocal(hits[0].point.clone());
    const disc = Math.hypot(local.x, local.y - DISC.y) < DISC.r && local.z > 0.08;
    return { part: disc ? 'disc' : 'body', distance: hits[0].distance };
  }

  inView(frustum: THREE.Frustum) {
    if (!this.bounds.radius) {
      this.group.updateWorldMatrix(true, true);
      new THREE.Box3().setFromObject(this.group).getBoundingSphere(this.bounds);
    }
    return frustum.intersectsSphere(this.bounds);
  }

  press(part: BoomboxPart) {
    if (!album.selfHosted || this.failed) {
      window.open(album.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (this.state === 'playing' && part === 'disc') this.play((this.track + 1) % album.tracks.length);
    else if (this.state === 'playing') this.pause();
    else this.play(this.track);
  }

  /** The hall left the screen (another page): nothing would be left to stop it with. */
  pause() {
    if (this.state !== 'playing') return;
    this.audio?.pause();
    this.state = 'paused';
    this.changed();
  }

  /**
   * Advances the disc, the trims and the display. Returns true while something visible changes; `visible` false
   * (off camera) keeps the music and the state going but skips the drawing.
   */
  update(now: number, visible: boolean): boolean {
    const dt = this.updatedAt ? Math.min(0.1, (now - this.updatedAt) / 1000) : 0;
    this.updatedAt = now;
    let moving = false;
    let bass = 0;
    if (this.state === 'playing' && this.analyser && this.bins && !this.opts.reduce) {
      this.analyser.getByteFrequencyData(this.bins);
      const bins = this.bins, hz = this.analyser.context.sampleRate / this.analyser.fftSize;
      const band = (lo: number, hi: number) => {
        const a = Math.max(1, Math.floor(lo / hz)), b = Math.max(a + 1, Math.ceil(hi / hz));
        let sum = 0;
        for (let i = a; i < b; i++) sum += bins[i];
        return sum / (b - a) / 255;
      };
      bass = band(40, 140);
      for (let i = 0; i < BARS; i++) this.bars[i] = band(60 * Math.pow(200, i / BARS), 60 * Math.pow(200, (i + 1) / BARS));
    } else this.bars.fill(0);
    // The pulse follows hits above the track's own running bass level, so a quiet intro and a dense break both move.
    this.envelope = Math.max(bass, this.envelope * Math.exp(-dt / 0.12));
    this.bassLevel += (bass - this.bassLevel) * (1 - Math.exp(-dt / 1.6));
    const pulse = THREE.MathUtils.clamp((this.envelope - this.bassLevel) / Math.max(0.06, this.bassLevel * 0.45), 0, 1);
    const trim = this.state !== 'playing' ? TRIM.idle : this.opts.reduce ? 0.7 : 0.34 + 0.6 * this.bassLevel + 1.4 * pulse;
    if (this.body && Math.abs(this.body.emissiveIntensity - trim) > 0.003) {
      this.body.emissiveIntensity = trim;
      moving = true;
    }
    const target = this.state === 'playing' && !this.opts.reduce ? SPIN : 0;
    this.spin += (target - this.spin) * (1 - Math.exp(-dt * (target > this.spin ? 2.6 : 1.3)));
    if (target === 0 && this.spin < 0.01) this.spin = 0;
    if (this.spin > 0) {
      this.angle = (this.angle + this.spin * Math.PI * 2 * dt) % (Math.PI * 2);
      if (visible) for (const map of this.discMaps) map.rotation = -this.angle;
      moving = true;
    }
    if (visible && this.drawScreen(now)) moving = true;
    return visible && moving;
  }

  /** Stops the music for good (the hall is going away); GPU resources follow in dispose(). */
  silence() {
    this.disposed = true;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    }
    void this.context?.close().catch(() => {});
    this.context = undefined;
    this.audio = undefined;
  }

  dispose() {
    this.silence();
    this.owned.forEach((resource) => resource.dispose());
  }

  private changed() {
    this.syncTwin();
    this.opts.onChange();
  }

  /* ---------- Playback ---------- */
  private play(index: number) {
    const audio = this.ensureAudio();
    const track = album.tracks[index];
    if (index !== this.track || !audio.getAttribute('src')) {
      this.track = index;
      audio.src = track.src;
    }
    // Created and resumed inside the click: browsers only let a gesture start audio.
    void this.context?.resume().catch(() => {});
    this.state = 'playing';
    audio.play().catch(() => {
      if (this.disposed) return;
      this.state = 'stopped';
      this.changed();
    });
    this.changed();
  }

  private ensureAudio() {
    if (this.audio) return this.audio;
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = 0.8;
    audio.addEventListener('ended', () => {
      if (this.track + 1 < album.tracks.length) this.play(this.track + 1);
      else {
        // After the last track the player stops on the first, as a CD player does.
        this.state = 'stopped';
        this.track = 0;
        audio.removeAttribute('src');
        this.changed();
      }
    });
    audio.addEventListener('error', () => {
      if (this.disposed || !audio.getAttribute('src')) return;
      // A file that does not load: the next click goes to Spotify instead.
      this.failed = true;
      this.state = 'stopped';
      this.changed();
    });
    this.audio = audio;
    try {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Context) {
        const context = new Context();
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.6;
        analyser.minDecibels = -88;
        analyser.maxDecibels = -22;
        context.createMediaElementSource(audio).connect(analyser);
        analyser.connect(context.destination);
        this.context = context;
        this.analyser = analyser;
        this.bins = new Uint8Array(analyser.frequencyBinCount);
      }
    } catch {
      // Without the analyser it still plays, only the trims and the spectrum stay still.
    }
    return audio;
  }

  /* ---------- Display ---------- */
  private makeScreen() {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS.w;
    canvas.height = CANVAS.h;
    const texture = new THREE.CanvasTexture(canvas);
    // the overlay's UVs run top-down like glTF's
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.owned.push(texture);
    return { ctx: canvas.getContext('2d')!, texture };
  }

  /** Redraws when what it shows changed; at most 30 times a second while the spectrum moves. */
  private drawScreen(now: number, force = false) {
    const playing = this.state === 'playing';
    if (!force && playing && now - this.drawnAt < 33) return false;
    if (!force && this.state === 'stopped' && this.drawn.startsWith('stopped')) return false;
    const elapsed = this.audio && this.state !== 'stopped' ? this.audio.currentTime : 0;
    const blink = this.state === 'paused' && Math.floor(now / 500) % 2 === 1;
    const levels = Array.from(this.bars, (v) => Math.round(Math.min(1, Math.max(0, (v - 0.18) / 0.62)) * 6));
    const digits = this.state === 'stopped' ? String(album.tracks.length).padStart(2, '0') : String(this.track + 1).padStart(2, '0');
    const time = this.state === 'stopped' ? ALBUM_LENGTH : clock(elapsed);
    const key = `${this.state}|${digits}|${blink ? '' : time}|${levels.join('')}`;
    if (!force && key === this.drawn) return false;
    this.drawn = key;
    this.drawnAt = now;
    const { ctx, texture } = this.screen;
    const { x0, x1, y0, y1 } = STRIP;
    ctx.clearRect(0, 0, CANVAS.w, CANVAS.h);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x0, y0, x1 - x0, y1 - y0, 6);
    ctx.clip();
    const light = ctx.createLinearGradient(0, y0, 0, y1);
    light.addColorStop(0, '#c6cbfb');
    light.addColorStop(1, '#a3acee');
    ctx.fillStyle = light;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // the bezel's shadow along the top edge
    ctx.fillStyle = 'rgba(28,30,72,.22)';
    ctx.fillRect(x0, y0, x1 - x0, 3);
    const ink = '#1f2250', ghost = 'rgba(31,34,80,.075)';
    const top = y0 + 11, h = 36;
    this.drawDigits(digits, x0 + 12, top, h, ink, ghost);
    // transport symbol
    const iconX = x0 + 72, mid = top + h / 2;
    ctx.fillStyle = ink;
    if (this.state === 'playing') {
      ctx.beginPath(); ctx.moveTo(iconX, mid - 8); ctx.lineTo(iconX + 13, mid); ctx.lineTo(iconX, mid + 8); ctx.closePath(); ctx.fill();
    } else if (this.state === 'paused') {
      ctx.fillRect(iconX, mid - 8, 4.5, 16); ctx.fillRect(iconX + 8.5, mid - 8, 4.5, 16);
    } else ctx.fillRect(iconX + 0.5, mid - 6.5, 13, 13);
    // spectrum: segments stacked like the LED bars of the era, unlit ones faintly printed
    const timeW = time.length * 24 - 5 + 4;
    const timeX = x1 - 12 - timeW;
    const barsX0 = iconX + 30, barsX1 = timeX - 22, pitch = (barsX1 - barsX0 + 3) / BARS;
    for (let i = 0; i < BARS; i++) for (let s = 0; s < 6; s++) {
      ctx.fillStyle = s < levels[i] ? ink : ghost;
      ctx.fillRect(barsX0 + i * pitch, top + h - (s + 1) * 6 + 1.5, pitch - 3, 4.5);
    }
    if (!blink) this.drawDigits(time, timeX, top, h, ink, ghost);
    else this.drawDigits(time.replace(/\d/g, ' '), timeX, top, h, ink, ghost);
    ctx.restore();
    texture.needsUpdate = true;
    return true;
  }

  /** Seven-segment digits in a slight italic, every segment faintly visible as on a real LCD; ':' is two dots. */
  private drawDigits(text: string, x: number, y: number, h: number, ink: string, ghost: string) {
    const ctx = this.screen.ctx, w = 19, t = 4.6;
    let cx = x;
    for (const ch of text) {
      if (ch === ':') {
        ctx.fillStyle = ink;
        ctx.fillRect(cx, y + h * 0.28, 4, 4);
        ctx.fillRect(cx - 1.5, y + h * 0.66, 4, 4);
        cx += 9;
        continue;
      }
      const on = SEGMENTS[ch] ?? '';
      for (const s of 'abcdefg') {
        ctx.fillStyle = on.includes(s) ? ink : ghost;
        this.segment(s, cx, y, w, h, t);
      }
      cx += 24;
    }
  }

  private segment(s: string, x: number, y: number, w: number, h: number, t: number) {
    const ctx = this.screen.ctx, half = t / 2, gap = 0.9, slant = 0.11;
    // the italic: x shifts with height, measured from the digit's foot
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

  /* ---------- Disc ---------- */
  /**
   * The disc behind the window: a silver CD with an abstract printed label (no words), iridescent where its silver
   * shows. The overlay's UV square spans the window circle (reach 0.25 in the build), the disc reaches 0.8836 of its
   * half-width; outside it the canvas is transparent and the model's own window rim shows.
   */
  private makeDisc() {
    const size = 512, c = size / 2, R = 0.8836 * c;
    const colour = document.createElement('canvas'), props = document.createElement('canvas');
    colour.width = colour.height = props.width = props.height = size;
    const a = colour.getContext('2d')!, b = props.getContext('2d')!;
    const ring = (ctx: CanvasRenderingContext2D, r0: number, r1: number, style: string | CanvasGradient, from = 0, to = Math.PI * 2) => {
      ctx.beginPath();
      ctx.arc(c, c, r1, from, to);
      ctx.arc(c, c, r0, to, from, true);
      ctx.closePath();
      ctx.fillStyle = style;
      ctx.fill();
    };
    // props: R iridescence, G roughness, B metalness (three reads those channels from one map)
    const silver = a.createRadialGradient(c, c, R * 0.3, c, c, R);
    silver.addColorStop(0, '#d9dce6');
    silver.addColorStop(1, '#b9bdcb');
    ring(a, 0, R, silver);
    ring(b, 0, R, 'rgb(255,70,170)');
    // printed label: graphite violet with lavender arcs, open on different sides so the turning reads
    ring(a, R * 0.36, R * 0.9, '#5d5874');
    ring(b, R * 0.36, R * 0.9, 'rgb(0,120,0)');
    const lavender = '#b7a8ee';
    ring(a, R * 0.47, R * 0.5, lavender, 0.3, 5.1);
    ring(a, R * 0.6, R * 0.615, '#8f84c9', 2.2, 7.6);
    ring(a, R * 0.7, R * 0.78, '#cfc5ff', 4.1, 5.35);
    ring(a, R * 0.84, R * 0.855, lavender, 1.0, 4.4);
    // clear hub with its stacking ring, and the hole
    ring(a, R * 0.17, R * 0.34, '#9097a8');
    ring(b, R * 0.17, R * 0.34, 'rgb(200,30,140)');
    ring(a, R * 0.25, R * 0.27, '#cfd3de');
    ring(a, 0, R * 0.17, '#0c0d12');
    ring(b, 0, R * 0.17, 'rgb(0,210,0)');
    const make = (canvas: HTMLCanvasElement, srgb: boolean) => {
      const texture = new THREE.CanvasTexture(canvas);
      texture.flipY = false;
      texture.center.set(0.5, 0.5);
      texture.anisotropy = 4;
      if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
      this.owned.push(texture);
      this.discMaps.push(texture);
      return texture;
    };
    const map = make(colour, true), maps = make(props, false);
    const material = new THREE.MeshPhysicalMaterial({
      map, iridescenceMap: maps, roughnessMap: maps, metalnessMap: maps,
      // the smoked window in front of it: a violet-grey tint and the glass's own gloss
      color: new THREE.Color(0.8, 0.78, 0.88), roughness: 1, metalness: 1,
      iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [250, 800],
      clearcoat: 0.7, clearcoatRoughness: 0.06, envMapIntensity: 1.1, alphaTest: 0.5,
    });
    this.owned.push(material);
    return material;
  }

  /* ---------- Road case ---------- */
  /** A low road case: black laminate, aluminium edges, ball corners and two latches, with soft contact shadows. */
  private makeCase(): THREE.Object3D[] {
    const { w, h, d } = CASE;
    const shell = new RoundedBoxGeometry(w, h, d, 2, 0.01);
    shell.translate(0, h / 2, 0);
    const metal: THREE.BufferGeometry[] = [];
    const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
      const g = new THREE.BoxGeometry(sx, sy, sz);
      g.translate(x, y, z);
      metal.push(g);
    };
    const e = 0.028, hx = w / 2 - e / 2 + 0.003, hz = d / 2 - e / 2 + 0.003;
    for (const y of [e / 2, h - e / 2]) {
      for (const z of [-hz, hz]) box(w + 0.006, e, e, 0, y, z);
      for (const x of [-hx, hx]) box(e, e, d + 0.006, x, y, 0);
    }
    for (const x of [-hx, hx]) for (const z of [-hz, hz]) box(e, h, e, x, h / 2, z);
    // the lid's seam band and the latches across it on the front
    box(w + 0.004, 0.016, d + 0.004, 0, h * 0.78, 0);
    for (const x of [-w * 0.27, w * 0.27]) box(0.06, 0.05, 0.012, x, h * 0.78, d / 2 + 0.008);
    const balls = [];
    for (const x of [-1, 1]) for (const y of [0, 1]) for (const z of [-1, 1]) {
      const g = new THREE.SphereGeometry(0.021, 12, 8);
      g.translate(x * (w / 2 - 0.004), y ? h - 0.004 : 0.017, z * (d / 2 - 0.004));
      balls.push(g);
    }
    const metalGeometry = mergeGeometries([...metal, ...balls].map((g) => g.toNonIndexed()));
    [...metal, ...balls].forEach((g) => g.dispose());
    // matte black laminate; the cabinets' panel finish glittered on a surface this small
    const panel = new THREE.Mesh(shell, new THREE.MeshStandardMaterial({ name: 'case_panel', color: 0x15161a, roughness: 0.82, envMapIntensity: 0.4 }));
    // aluminium extrusions: half metal, so the room's light reaches them and not only the dark sky
    const trim = new THREE.Mesh(metalGeometry, new THREE.MeshStandardMaterial({ name: 'case_trim', color: 0xb4b9c2, roughness: 0.42, metalness: 0.55, envMapIntensity: 0.8 }));
    panel.name = 'boombox-case';
    trim.name = 'boombox-case-trim';
    for (const mesh of [panel, trim]) this.owned.push(mesh.material as THREE.Material, mesh.geometry);
    // contact shadows: on the floor around the case, and on the lid under the player
    const blob = document.createElement('canvas');
    blob.width = blob.height = 128;
    const g2 = blob.getContext('2d')!;
    const fade = g2.createRadialGradient(64, 64, 18, 64, 64, 64);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    g2.fillStyle = fade;
    g2.fillRect(0, 0, 128, 128);
    const shadowMap = new THREE.CanvasTexture(blob);
    const shadow = (sx: number, sz: number, y: number, opacity: number) => {
      const material = new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, opacity, color: 0x000000, toneMapped: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = y;
      mesh.renderOrder = 1;
      this.owned.push(material, mesh.geometry);
      return mesh;
    };
    this.owned.push(shadowMap);
    return [panel, trim, shadow(w * 1.55, d * 1.7, 0.003, 0.62), shadow(0.6, 0.32, h + 0.002, 0.5)];
  }
}
