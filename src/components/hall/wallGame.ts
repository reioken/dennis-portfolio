import * as THREE from 'three';
import { WALL_GAME_COLS, WALL_GAME_GLYPHS, WALL_GAME_ROWS, type WallGameUniforms } from './wallPaint';
import { DIGIT_STROKES, drip, mulberry, smooth, spray, sprayGlyph, wear, type Pt } from './wallSpray';
import { WallTag } from './wallTag';

/**
 * "Your tag" — Breakout sprayed on the hall's brick wall, left of the claw machine.
 *
 * The ball is a spray nozzle. Wherever it flies it leaves a sprayed line on the wall, and the line stays: by the
 * end of a round the visitor has scribbled a tag across the bricks that nobody else will ever make. It remains on
 * the wall (and in localStorage, so a returning visitor finds it again) until the next round starts, when it is
 * buffed and a new one begins.
 *
 * Nothing here is geometry: every mark is pigment mixed into the wall's own diffuse inside the brick material's
 * `onBeforeCompile` (wallPaint.ts), through the same brick-luminance modulation, lit by the same normal map.
 * The blocks ARE the wall's bricks — the texture lays 240 x 73 mm bricks on a 250 x 83.33 mm grid in running bond
 * (scripts/assets/hall-wall-texture.py), and the field is snapped onto that grid.
 *
 * Where the paint comes from:
 *   frame marks      one canvas, sprayed once (wallSpray.ts), uploaded once
 *   digits, can ...  one sprite atlas, sprayed once; the shader places sprites by uniform, so a changing score
 *                    uploads nothing and a changed digit is "re-sprayed" by animating its ink uniform
 *   the tag          accumulated on the GPU (wallTag.ts): a few centimetres of new line per frame
 *
 * Cost when it is not on screen: none. Everything is built the first time the field becomes visible, the
 * simulation only runs while playing, and the idle state is static so it asks the hall for no frames at all.
 */

/* ---------- the wall's masonry ---------- */
const BRICK = 0.25;                 // brick pitch, metres
const COURSE = 1 / 12;              // course pitch, metres (83.33 mm)
const COLS_MAX = WALL_GAME_COLS;    // full bricks in a wide row; the half-bond rows carry one less
const COLS_MIN = 7;
const ROWS = WALL_GAME_ROWS;
/** Lowest painted course. Even, so the bottom row is the half-bond (narrow) one. */
const BASE_COURSE = 30;
/**
 * Right edge of the play field before it is snapped to the brick grid. Dennis's red box, 2026-09-21: far left of
 * the claw machine, high on the wall, big. The cabinet's silhouette falls on the wall at about x = -0.63 and the
 * ÜBER MICH lettering starts at x = -1.42; this leaves 0.5 m of bare brick to the lettering.
 */
const TARGET_RIGHT = -1.99;

/* ---------- the field, in metres above the floor ---------- */
const BLOCKS_Y0 = BASE_COURSE * COURSE;               // 2.5
const BLOCKS_Y1 = (BASE_COURSE + ROWS) * COURSE;      // 3.0
const PLAY_TOP = BLOCKS_Y1 + 0.035;
const PADDLE_Y = 1.475;
const PADDLE_HW = 0.25;
const PADDLE_HH = 0.056;
const DEATH_Y = 1.385;
const BALL_R = 0.036;
const SCORE_CELL = 0.335;                             // sprite cell height; the digit itself is 74 % of it
const BEST_CELL = 0.215;
const HUD_Y = PLAY_TOP + 0.075;                       // bottom of the score cell
const ICON_H = 0.66;
const ICON_Y = 1.99;
/** Under a crowned piece the play mark steps down, out of the crown. */
const ICON_H_CROWNED = 0.40;
const ICON_Y_CROWNED = 1.775;
/** How much pigment the resting play mark carries; the attract pulse tops it back up to 1. */
const ICON_INK = 0.90;
const LIVES_Y = 1.125;
const LIVES_CELL = 0.175;
const FRAME_OUT = 0.076;                              // how far the frame marks reach outside the play field
const CLICK_PAD = 0.12;                               // the field takes clicks this far outside its walls
/**
 * The painted rect (mask + tag target) is much bigger than the field: a generous bleed on every side, more below
 * for drips, so no arrowhead, blot, haze or drip ever reaches its edge — and the shader fades the last 8 cm to
 * nothing anyway, so a straight cut is impossible.
 */
const BLEED_X = 0.34;
const RECT_Y0 = DEATH_Y - 0.50;
const RECT_Y1 = HUD_Y + SCORE_CELL + 0.14;
const RECT_H = RECT_Y1 - RECT_Y0;
const RECT_W = COLS_MAX * BRICK + 2 * BLEED_X;

const MASK_W = 1280;
const MASK_H = Math.round(MASK_W * RECT_H / RECT_W);

/* ---------- the visitor's can ---------- */
/**
 * One constant decides the colour in the visitor's can: a muted, darker lilac, so the white nozzle (the ball, in the
 * marks' own white) never gets lost in its trail. `null` sprays a light grey instead — same idea, no colour.
 */
export const WALL_GAME_ACCENT: string | null = '#7e6cc2';
const TRAIL_GREY = '#70767e';
const LINE_R = 0.0092;                                // core radius of the flying line
const TAG_KEY = 'hall.wall-game.tag.v2';                // v2: the painted rect grew, and the points are stored relative to it
const BEST_KEY = 'hall.wall-game.best';
const TAG_MAX = 560;                                  // impact points kept for replay: 5 bytes each, < 4 KB stored
/** What one pass of the ball leaves for good; passes add up. */
const COAT = 0.19;
const SETTLE_MS = 260;
const SETTLE_K = 0.962;
const BUFF_MS = 820;
const BUFF_GHOST = 0.10;
const MAX_DRIPS = 10;

/* ---------- the bar lamp above the field ---------- */
const LAMP_Y = HUD_Y + SCORE_CELL + 0.20;             // the batten hangs this high
const LAMP_THROW = 3.3;                              // how far its wash reaches down the wall
/** The tube is a little longer than the field is wide, so the outer bricks are lit like the middle ones. */
export const WALL_GAME_LAMP_OVERHANG = 0.10;
const LAMP_COLOR = new THREE.Color('#cdd5e6');
const LAMP_GAIN = 4.3;

/* ---------- attract ---------- */
const HINT_PERIOD_MS = 6000;
const HINT_MS = 620;

/* ---------- play ---------- */
const STEP = 1 / 120;
const SPEED_0 = 1.72;
const SPEED_PER_ROW = 0.10;
const SPEED_MAX = 2.35;
const KEY_SPEED = 2.3;
const LIVES = 3;
const FLAKE_MS = 250;
const END_PAUSE_MS = 1500;
const REPAINT_ROW_MS = 260;
const REPAINT_COL_MS = 26;
const SERVE_MS = 1000;
/** After a lost life the ball waits on the can; nobody serves it for this long and the round is over. */
const SERVE_WAIT_MS = 8000;
const STOP_SIZE = 0.15;
const INK_MS = 240;

/* ---------- sprite slots (wallGameGlyph*) ---------- */
const G_SCORE = 0, G_BEST = 3, G_CROWN = 7, G_LIVES = 8, G_ICON = 11, G_CAN = 12, G_STOP = 13;

/* ---------- impact kinds, stored with the tag ---------- */
const K_START = 0, K_BLOCK = 1, K_WALL = 2, K_PADDLE = 3, K_LOST = 4;

type Mode = 'idle' | 'buff' | 'serve' | 'play' | 'end' | 'repaint';
type Cell = { x: number; y: number; w: number; h: number };

/* ---------- the sprite atlas ---------- */
const ATLAS_W = 1280, ATLAS_H = 392;
const DIGIT_CELL_W = 110, DIGIT_CELL_H = 120;
const CELLS = {
  digit: (d: number): Cell => ({ x: d * DIGIT_CELL_W, y: 0, w: DIGIT_CELL_W, h: DIGIT_CELL_H }),
  can: { x: 0, y: 124, w: 480, h: 120 } as Cell,
  icon: { x: 490, y: 124, w: 264, h: 264 } as Cell,
  crown: { x: 764, y: 124, w: 230, h: 170 } as Cell,
  dot: { x: 1004, y: 124, w: 90, h: 90 } as Cell,
  cross: { x: 1104, y: 124, w: 90, h: 90 } as Cell,
  stop: { x: 1004, y: 224, w: 90, h: 90 } as Cell,
};
/** The can sprite's scale: the collision bar (2 x PADDLE_HW) spans x = 30..456 px of its cell. */
const CAN_PX_PER_M = 426 / (2 * PADDLE_HW);

function hash1(a: number, b: number) {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function readBest() {
  try { return Math.max(0, Math.min(9999, Number(localStorage.getItem(BEST_KEY)) || 0)); }
  catch { return 0; }
}
function writeBest(value: number) {
  try { localStorage.setItem(BEST_KEY, String(value)); } catch { /* private mode: the page works without it */ }
}

interface StrokeJob { pts: Float32Array; total: number; radius: number; taper: number; seed: number; speed: number; s: number; delay: number; halo: number }

export class WallGame {
  /** World rect of everything painted (the mask and the tag target); fixed, whatever the column count. */
  readonly rect: { x: number; y: number; w: number; h: number };
  private left = 0;
  private readonly right: number;
  private cols = COLS_MAX;

  private built = false;
  private visible = false;
  private hidden = false;
  private engaged = false;
  private served = 0;
  private reduce = false;

  private canvas?: HTMLCanvasElement;
  private maskTex?: THREE.CanvasTexture;
  private atlasTex?: THREE.CanvasTexture;
  private blockTex?: THREE.DataTexture;
  private blockData = new Uint8Array(COLS_MAX * ROWS * 4);
  private tag?: WallTag;

  private mode: Mode = 'idle';
  private alive = new Uint8Array(COLS_MAX * ROWS);
  private paint = new Float32Array(COLS_MAX * ROWS);
  private paintDelay = new Float32Array(COLS_MAX * ROWS);
  private score = 0;
  private best = 0;
  private lives = LIVES;
  private clearedRows = 0;
  private ball = { x: 0, y: 0, vx: 0, vy: 0 };
  private paddleX = 0;
  private paddleGoal = 0;
  private keyDir = 0;
  private paddleV = 0;
  private phaseAt = 0;
  private repaintRow = -1;
  private cleared = false;
  private flecks = Array.from({ length: 6 }, () => ({ x: 0, y: 0, vx: 0, vy: 0, r: 0, ttl: 0 }));
  private last = 0;
  private acc = 0;
  private hintAt = 0;
  private iconInk = ICON_INK;
  private shake = 0;
  private puff = { x: 0, y: 0, r: 0, a: 0, ttl: 0, dur: 1 };
  private rng = mulberry(20260921);

  /* the HUD sprites: what each slot shows (-1 = nothing) and how far its re-spray has come */
  private slotCell = new Int16Array(WALL_GAME_GLYPHS).fill(-2);
  private slotInk = new Float32Array(WALL_GAME_GLYPHS).fill(1);

  /* the tag: impact points (quantised to the rect), their kind and the ball's speed level, for replay */
  private tagPts = new Uint16Array(TAG_MAX * 2);
  private tagKind = new Uint8Array(TAG_MAX);
  private tagN = 0;
  /** 0 = unsigned, 1 = signed (game over), 2 = crowned (cleared wall) */
  private tagSigned = 0;
  private penDown = false;
  private penAx = 0; private penAy = 0; private penS = 0; private penSeed = 0;
  private drips = Array.from({ length: MAX_DRIPS }, () => ({ x: 0, y: 0, len: 0, r: 0, t: 0, dur: 0, drawn: 0, seed: 0, on: false }));
  private jobs: StrokeJob[] = [];
  private replayAt = -1;
  private restamp = false;
  private settleAt = 0;
  private buffFront = 0;
  private buffSeed = 1;
  private hasPaint = false;
  private power = 1;

  /** Centre of the painted field and the lamp's height: the lamp and the pool hang off these. */
  centreX = 0;
  readonly lampY: number;
  /** Called when the column count (and with it the field's centre and width) changes. */
  onLayout?: (centreX: number, width: number) => void;

  constructor(private u: WallGameUniforms, wallCenterX: number, private request: () => void, private renderer: () => THREE.WebGLRenderer) {
    // Snap the field onto the real brick grid: the texture's columns repeat every 250 mm from the wall's own origin.
    this.right = wallCenterX + Math.round((TARGET_RIGHT - wallCenterX) / BRICK) * BRICK;
    this.rect = { x: this.right - COLS_MAX * BRICK - BLEED_X, y: RECT_Y0, w: RECT_W, h: RECT_H };
    this.lampY = LAMP_Y;
    this.best = readBest();
    this.applyCols(COLS_MAX);
  }

  /* ---------- geometry ---------- */
  private narrow(row: number) { return (BASE_COURSE + row) % 2 === 0; }
  private rowLeft(row: number) { return this.left + (this.narrow(row) ? BRICK / 2 : 0); }
  private rowCols(row: number) { return this.narrow(row) ? this.cols - 1 : this.cols; }
  private rowY(row: number) { return BLOCKS_Y0 + row * COURSE; }
  private points(row: number) { return row >= ROWS - 2 ? 7 : row >= ROWS - 4 ? 5 : 3; }
  private get parity() { return BASE_COURSE % 2 === 0 ? 1 : 0; }
  private get totalBlocks() { let n = 0; for (let r = 0; r < ROWS; r++) n += this.rowCols(r); return n; }

  /** The painted extent a window has to hold: the hall asks this to pick a column count. */
  static paintedLeft(right: number, cols: number) { return right - cols * BRICK - FRAME_OUT; }
  static readonly COLS_MAX = COLS_MAX;
  static readonly COLS_MIN = COLS_MIN;
  get fieldRight() { return this.right; }

  /** Narrower windows play on fewer bricks, always whole ones, anchored at the right edge. */
  setCols(cols: number) {
    cols = Math.max(COLS_MIN, Math.min(COLS_MAX, Math.round(cols)));
    if (cols === this.cols) return;
    this.applyCols(cols);
    if (this.built) {
      // a different wall: the round and the tag on it do not carry over
      this.mode = 'idle';
      this.clearTag(false);
      this.drawMask();
      this.writeStatics();
      this.writeBlocks();
      this.sync();
      this.request();
    }
  }

  private applyCols(cols: number) {
    this.cols = cols;
    this.left = this.right - cols * BRICK;
    this.centreX = (this.left + this.right) / 2;
    this.paddleX = this.paddleGoal = this.centreX;
    this.resetField();
    this.onLayout?.(this.centreX, cols * BRICK);
  }

  contains(x: number, y: number) {
    return x >= this.left - CLICK_PAD && x <= this.right + CLICK_PAD && y >= DEATH_Y - 0.26 && y <= HUD_Y + SCORE_CELL;
  }

  get playing() { return this.mode === 'play' || this.mode === 'serve' || this.mode === 'buff'; }
  get running() { return this.engaged; }
  /** True while the field is painted on the wall and can take a click. */
  canPlayAt(x: number, y: number) { return this.visible && this.built && this.contains(x, y); }
  /** True while the can should follow the pointer, so hovering costs nothing otherwise. */
  get wantsPointer() { return this.visible && this.built && !this.hidden && this.playing; }
  get state() {
    return {
      mode: this.mode, score: this.score, best: this.best, lives: this.lives, cols: this.cols, totalBlocks: this.totalBlocks,
      blocks: this.alive.reduce((a, b) => a + b, 0), ball: { ...this.ball }, paddleX: this.paddleX,
      engaged: this.engaged, visible: this.visible,
      tagPoints: this.tagN, tagSigned: this.tagSigned, hasPaint: this.hasPaint, jobs: this.jobs.length, replaying: this.replayAt >= 0,
      stop: this.stopRect, served: this.served,
      field: { paintedLeft: this.left - FRAME_OUT, left: this.left, right: this.right, top: PLAY_TOP, bottom: DEATH_Y, blocksY0: BLOCKS_Y0, paddleY: PADDLE_Y },
    };
  }

  /**
   * The batten is on the room's circuit: while the hall powers up (roomPower.mjs) the hall hands us the circuit
   * level for the lamp's position each frame, and 1 once the room is on. The paint itself needs nothing — it is
   * pigment in the wall and is lit, or not, by whatever lights the wall.
   */
  setPower(level: number) {
    if (level === this.power) return;
    this.power = level;
    if (this.built) this.u.wallGameLightColor.value.copy(LAMP_COLOR).multiplyScalar(LAMP_GAIN * level);
  }

  /* ---------- lifecycle ---------- */
  setVisible(on: boolean, reduce = this.reduce) {
    this.reduce = reduce;
    if (on === this.visible) return;
    this.visible = on;
    // Build here and now. An idle callback looked cheaper, but the hall renders every frame in the hall pose, so a
    // real browser may never report an idle slice and the field then stays unpainted for the whole visit.
    if (on && !this.built) this.build();
    this.u.wallGameOpacity.value = on && this.built ? 0.91 : 0;
    // Walking away mid-round ends it: the piece is signed and kept, the wall is whole again when they come back.
    if (!on) { this.stopRound(true); this.pause(); }
    else { this.last = performance.now(); this.acc = 0; this.sync(); }
    this.request();
  }

  /** A few milliseconds of canvas work, paid once, the first time the field is actually on the wall. */
  private build() {
    const canvas = document.createElement('canvas');
    canvas.width = MASK_W;
    canvas.height = MASK_H;
    this.canvas = canvas;
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 8;
    this.maskTex = tex;
    const atlas = new THREE.CanvasTexture(this.drawAtlas());
    atlas.anisotropy = 8;
    this.atlasTex = atlas;
    const blocks = new THREE.DataTexture(this.blockData, COLS_MAX, ROWS, THREE.RGBAFormat);
    blocks.magFilter = blocks.minFilter = THREE.NearestFilter;
    blocks.generateMipmaps = false;
    blocks.needsUpdate = true;
    this.blockTex = blocks;
    this.tag = new WallTag(this.rect, MASK_W);
    this.tag.warm(this.renderer());
    this.u.wallGameMask.value = tex;
    this.u.wallGameAtlas.value = atlas;
    this.u.wallGameBlocks.value = blocks;
    this.u.wallGameTag.value = this.tag.texture;
    this.u.wallGameRect.value.set(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    this.u.wallGameTagColor.value.set(WALL_GAME_ACCENT ?? TRAIL_GREY);
    this.u.wallGameLightColor.value.copy(LAMP_COLOR).multiplyScalar(LAMP_GAIN * this.power);
    this.built = true;
    this.hidden = document.hidden;
    this.drawMask();
    this.writeBlocks();
    this.writeStatics();
    this.loadTag();
    this.sync();
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
    this.renderer().domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer().domElement.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  dispose() {
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    try {
      this.renderer().domElement.removeEventListener('webglcontextlost', this.onContextLost);
      this.renderer().domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
    } catch { /* renderer already gone */ }
    this.setEngaged(false);
    this.maskTex?.dispose();
    this.atlasTex?.dispose();
    this.blockTex?.dispose();
    this.tag?.dispose();
    this.built = false;
  }

  private onVisibility = () => {
    this.hidden = document.hidden;
    if (this.hidden) { this.stopRound(true); this.pause(); }
    else { this.last = performance.now(); this.acc = 0; this.sync(); this.request(); }
  };
  private onPageHide = () => { if (this.mode !== 'idle') this.saveTag(); };

  /**
   * A lost GL context takes the target's pixels with it. The hall answers a lost context by falling back to its
   * CSS backdrop (Stage3D.tsx), so what matters is that the piece is in storage: the next load sprays it again.
   */
  private onContextLost = () => { this.saveTag(); this.pause(); };
  /** Should a host keep the scene alive instead: spray the tag again from the points we kept. */
  private onContextRestored = () => {
    this.tag?.clear();
    this.jobs.length = 0;
    for (const d of this.drips) d.on = false;
    this.restamp = true;
    this.request();
  };

  private pause() { this.setEngaged(false); }

  /** The keyboard belongs to the hall unless the visitor actually started the game. */
  private setEngaged(on: boolean) {
    if (on === this.engaged) return;
    this.engaged = on;
    if (on) {
      window.addEventListener('keydown', this.onKeyDown, true);
      window.addEventListener('keyup', this.onKeyUp, true);
    } else {
      window.removeEventListener('keydown', this.onKeyDown, true);
      window.removeEventListener('keyup', this.onKeyUp, true);
      this.keyDir = 0;
    }
  }

  private sync() {
    // Only a running round owns the keys; the moment it ends (Escape, the stop mark, the last life) they go back.
    const wants = this.visible && this.built && !this.hidden && this.playing;
    this.setEngaged(wants);
  }

  /* ---------- input ---------- */
  /** The play field proper: between the walls, above the death line. */
  private inPlayArea(x: number, y: number) {
    return x >= this.left && x <= this.right && y >= DEATH_Y && y <= PLAY_TOP;
  }
  private get stopRect() { return { x: this.right - STOP_SIZE - 0.05, y: DEATH_Y - 0.15 - STOP_SIZE, w: STOP_SIZE, h: STOP_SIZE }; }

  /**
   * A click inside the field starts or launches; while a round runs, a click on the stop mark or anywhere outside
   * the play area ends it. Returns true when the game took the click.
   */
  press(x: number, y: number) {
    if (!this.visible || !this.built || !this.contains(x, y)) return false;
    this.last = performance.now();
    this.acc = 0;
    if (this.playing && !this.inPlayArea(x, y)) { this.stopRound(false); this.request(); return true; }
    if (this.mode === 'idle') {
      this.startGame();
      this.paddleGoal = this.paddleX = this.clampPaddle(x);
      this.restBall();
    } else if (this.mode === 'serve') {
      this.paddleGoal = this.clampPaddle(x);
      this.launch();
    }
    this.sync();
    this.request();
    return true;
  }

  /** Pointer over the field: the can follows it while the game runs. */
  move(x: number, y: number) {
    if (!this.wantsPointer || !this.contains(x, y)) return false;
    this.paddleGoal = this.clampPaddle(x);
    this.request();
    return true;
  }

  /** A finger that went down on the field keeps the can even when it wanders off the field's height. */
  drag(x: number) {
    if (!this.wantsPointer) return false;
    this.paddleGoal = this.clampPaddle(x);
    this.request();
    return true;
  }

  private clampPaddle(x: number) {
    return Math.max(this.left + PADDLE_HW, Math.min(this.right - PADDLE_HW, x));
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.engaged || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    switch (e.key) {
      case 'Escape':
        // ends the round: the piece is signed and stays, the keys go back to the hall
        this.stopRound(false);
        break;
      case 'ArrowLeft': case 'a': case 'A': this.keyDir = -1; break;
      case 'ArrowRight': case 'd': case 'D': this.keyDir = 1; break;
      case ' ': case 'Spacebar': if (this.mode === 'serve') this.launch(); break;
      default: return;
    }
    e.preventDefault();
    this.last = performance.now();
    this.request();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (!this.engaged) return;
    if ((e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') && this.keyDir < 0) this.keyDir = 0;
    if ((e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') && this.keyDir > 0) this.keyDir = 0;
  };

  /* ---------- rounds ---------- */
  private resetField() {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS_MAX; c++) {
      const i = r * COLS_MAX + c;
      const on = c < this.rowCols(r) ? 1 : 0;
      this.alive[i] = on;
      this.paint[i] = on;
      this.paintDelay[i] = 0;
    }
    this.lives = LIVES;
    this.clearedRows = 0;
    this.restBall();
  }

  private restBall() {
    this.ball.x = this.paddleX;
    this.ball.y = PADDLE_Y + PADDLE_HH + BALL_R;
    this.ball.vx = this.ball.vy = 0;
  }

  private startGame() {
    this.resetField();
    this.score = 0;
    this.cleared = false;
    this.phaseAt = performance.now();
    // Finish whatever is still being sprayed, then buff the old piece: a new round starts on a clean wall.
    this.finishJobs();
    if (this.hasPaint && !this.reduce) { this.mode = 'buff'; this.buffFront = -0.2; this.buffSeed = 1 + ((this.rng() * 40) | 0); }
    else { if (this.hasPaint) this.clearTag(true); this.mode = 'serve'; this.phaseAt = performance.now() - SERVE_MS + 120; }
    this.tagN = 0;
    this.tagSigned = 0;
    this.served = 0;
    this.penDown = false;
    try { localStorage.removeItem(TAG_KEY); } catch { /* storage blocked: nothing to forget */ }
  }

  private launch() {
    if (this.mode !== 'serve') return;
    const speed = Math.min(SPEED_MAX, SPEED_0 + this.clearedRows * SPEED_PER_ROW);
    const a = Math.PI / 2 + (this.rng() - 0.5) * 0.62;
    this.ball.x = this.paddleX;
    this.ball.y = PADDLE_Y + PADDLE_HH + BALL_R;
    this.ball.vx = Math.cos(a) * speed;
    this.ball.vy = Math.sin(a) * speed;
    this.mode = 'play';
    this.served += 1;
    this.impact(K_START);
    if (!this.reduce) this.puffAt(this.paddleX + PADDLE_HW + 0.05, PADDLE_Y + 0.01, 0.11, 0.62, 520);
    this.sync();
  }

  private loseLife() {
    this.impact(K_LOST);
    this.lives -= 1;
    if (this.lives <= 0) { this.endRound(false); return; }
    this.mode = 'serve';
    this.phaseAt = performance.now();
    this.restBall();
    this.saveTag();
  }

  /**
   * The visitor stops (Escape, the stop mark, a click off the field, walking away) or nobody serves the ball: the
   * round is over, the piece gets its signature and stays. `instant` (leaving the station, hiding the tab) skips
   * every animation and puts the wall straight back to idle, whole, so nothing is ever frozen mid-air on return.
   */
  private stopRound(instant: boolean) {
    if (!this.playing) return;
    this.finishJobs();
    if (this.mode === 'buff') { this.tag?.buff(this.buffFront, 1.4, BUFF_GHOST, this.buffSeed); this.hasPaint = false; }
    this.endRound(false, true);
    if (instant) {
      this.finishJobs();
      this.mode = 'idle';
      this.resetField();
      this.paddleX = this.paddleGoal = this.centreX;
      this.restBall();
    }
    this.sync();
  }

  private endRound(cleared: boolean, short = false) {
    if (this.penDown) this.impact(K_LOST);
    this.mode = 'end';
    this.cleared = cleared;
    this.phaseAt = performance.now();
    this.repaintRow = -1;
    this.ball.vx = this.ball.vy = 0;
    this.restBall();
    if (this.score > this.best) { this.best = this.score; writeBest(this.best); }
    // The piece is finished: sign it. A cleared wall gets the crown.
    this.tagSigned = cleared ? 2 : 1;
    if (this.tagN > 1) this.sign(this.tagSigned, this.reduce, short);
    this.saveTag();
    this.sync();
  }

  /* ---------- simulation ---------- */
  update(now: number): boolean {
    if (!this.visible || !this.built || this.hidden) return false;
    let dt = (this.last ? now - this.last : 0) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.1);

    // Idle attract: every few seconds the can gets a shake, puffs, and the play mark is gone over once more.
    // Frames are asked for during that 0.6 s only; between pulses and when hidden the game stays silent.
    let hinting = false;
    this.shake = 0;
    if (this.mode === 'idle' && !this.reduce) {
      if (!this.hintAt) this.hintAt = now + HINT_PERIOD_MS;
      const since = now - this.hintAt;
      if (since >= HINT_MS) { this.hintAt = now + HINT_PERIOD_MS; this.iconInk = ICON_INK; }
      else if (since >= 0) {
        const env = Math.sin((since / HINT_MS) * Math.PI);
        this.iconInk = ICON_INK + (1 - ICON_INK) * env;
        this.shake = Math.sin(since * 0.055) * 0.011 * env;
        if (this.puff.ttl <= 0 && since > HINT_MS * 0.3 && since < HINT_MS * 0.5) this.puffAt(this.paddleX + PADDLE_HW + 0.05, PADDLE_Y + 0.01, 0.085, 0.42, 380);
        hinting = true;
      } else this.iconInk = ICON_INK;
    } else { this.iconInk = ICON_INK; this.hintAt = 0; }

    let busy = false;
    {
      if (this.mode === 'buff') {
        const t = Math.min(1, (now - this.phaseAt) / BUFF_MS);
        // ease in-out: the roller is put on, pulled across, lifted
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const front = -0.2 + e * 1.4;
        this.tag!.buff(this.buffFront, front, BUFF_GHOST, this.buffSeed);
        this.buffFront = front;
        if (t >= 1) { this.hasPaint = false; this.mode = 'serve'; this.phaseAt = now - SERVE_MS + 160; }
        busy = true;
      }
      if (this.mode === 'serve') {
        // The first ball of a round serves itself (the click that started it was the intent). After a lost life
        // the ball waits on the can for a click or Space; left alone, the round ends on its own.
        if (this.served === 0 && now - this.phaseAt > SERVE_MS) this.launch();
        else if (this.served > 0 && now - this.phaseAt > SERVE_WAIT_MS) { this.stopRound(false); }
      }
      if (this.mode === 'play') {
        this.acc = Math.min(this.acc + dt, 0.25);
        // A lost life ends the round or puts the ball back on the can: stop stepping it in this frame.
        while (this.acc >= STEP && this.mode === 'play') { this.acc -= STEP; this.step(STEP); }
        if (this.mode === 'play') this.penTo(this.ball.x, this.ball.y);
        busy = true;
      } else if (this.mode === 'end') {
        if (now - this.phaseAt > END_PAUSE_MS && !this.jobs.length) { this.mode = 'repaint'; this.phaseAt = now; this.repaintRow = -1; }
        busy = true;
      } else if (this.mode === 'repaint') {
        const want = this.reduce ? ROWS : Math.floor((now - this.phaseAt) / REPAINT_ROW_MS);
        while (this.repaintRow < Math.min(ROWS - 1, want)) {
          // top row first, each brick a moment after its neighbour: the can goes along the course
          this.repaintRow += 1;
          const row = ROWS - 1 - this.repaintRow;
          const dir = this.repaintRow % 2;
          for (let c = 0; c < this.rowCols(row); c++) {
            const i = row * COLS_MAX + c;
            if (!this.alive[i]) this.paintDelay[i] = this.reduce ? 0 : (dir ? this.rowCols(row) - 1 - c : c) * REPAINT_COL_MS / 1000;
            this.alive[i] = 1;
          }
        }
        busy = true;
      } else if (this.mode === 'serve') busy = true;
      if (this.playing) this.movePaddle(dt);
    }

    if (this.mode !== 'idle' && this.mode !== 'buff' && now - this.settleAt > SETTLE_MS) { this.settleAt = now; this.tag!.settle(SETTLE_K); }
    const painting = this.tickPaint(dt);
    if (this.mode === 'repaint' && !painting && this.repaintRow >= ROWS - 1) {
      this.mode = 'idle';
      this.resetField();
      this.paddleX = this.paddleGoal = this.centreX;
      this.restBall();
      this.sync();
    }
    this.tickFlecks(dt);
    const flecking = this.flecks.some(f => f.ttl > 0);
    const spraying = this.tickTag(now, dt);
    const inking = this.tickHud(dt);
    if (this.puff.ttl > 0) { this.puff.ttl = Math.max(0, this.puff.ttl - dt * 1000); busy = true; }
    this.writeUniforms();
    if (this.tag!.pending) this.tag!.flush(this.renderer());
    return busy || painting || flecking || spraying || inking || hinting;
  }

  private movePaddle(dt: number) {
    if (this.keyDir) this.paddleGoal = this.clampPaddle(this.paddleGoal + this.keyDir * KEY_SPEED * dt);
    const k = 1 - Math.exp(-dt * 26);
    const before = this.paddleX;
    this.paddleX += (this.paddleGoal - this.paddleX) * k;
    if (dt > 0) this.paddleV += ((this.paddleX - before) / dt - this.paddleV) * Math.min(1, dt * 18);
    if (Math.abs(this.paddleGoal - this.paddleX) < 0.0004) this.paddleX = this.paddleGoal;
    if (this.mode === 'serve' || this.mode === 'buff') this.ball.x = this.paddleX;
  }

  private step(h: number) {
    const b = this.ball;
    const speed = Math.hypot(b.vx, b.vy) || 1;
    const subs = Math.max(1, Math.ceil((speed * h) / 0.008));
    const sh = h / subs;
    for (let s = 0; s < subs; s++) {
      b.x += b.vx * sh;
      b.y += b.vy * sh;
      let wall = false;
      if (b.x - BALL_R < this.left) { b.x = this.left + BALL_R; b.vx = Math.abs(b.vx); wall = true; }
      else if (b.x + BALL_R > this.right) { b.x = this.right - BALL_R; b.vx = -Math.abs(b.vx); wall = true; }
      if (b.y + BALL_R > PLAY_TOP) { b.y = PLAY_TOP - BALL_R; b.vy = -Math.abs(b.vy); wall = true; }
      if (wall) this.impact(K_WALL);
      this.hitBlocks();
      if (this.mode !== 'play') return;
      // the can: where the ball lands on it sets the angle it leaves at
      if (b.vy < 0 && b.y - BALL_R <= PADDLE_Y + PADDLE_HH && b.y >= PADDLE_Y - PADDLE_HH) {
        if (Math.abs(b.x - this.paddleX) <= PADDLE_HW + BALL_R * 0.8) {
          const n = Math.max(-1, Math.min(1, (b.x - this.paddleX) / PADDLE_HW));
          const v = Math.hypot(b.vx, b.vy);
          // where it lands sets the angle; a can that is moving drags the ball along a little
          const a = Math.PI / 2 - Math.max(-1.12, Math.min(1.12, n * 1.02 + Math.max(-0.3, Math.min(0.3, this.paddleV * 0.16))));
          b.vx = Math.cos(a) * v;
          b.vy = Math.abs(Math.sin(a) * v);
          b.y = PADDLE_Y + PADDLE_HH + BALL_R;
          this.keepAngle();
          this.impact(K_PADDLE);
        }
      }
      if (b.y + BALL_R < DEATH_Y) { this.loseLife(); return; }
    }
    this.keepAngle();
  }

  /** No near-horizontal drift and no dead-vertical lock. */
  private keepAngle() {
    const b = this.ball;
    const v = Math.hypot(b.vx, b.vy);
    if (v < 1e-6) return;
    const minY = 0.30 * v, minX = 0.08 * v;
    if (Math.abs(b.vy) >= minY && Math.abs(b.vx) >= minX) return;
    if (Math.abs(b.vy) < minY) b.vy = Math.sign(b.vy || 1) * minY;
    if (Math.abs(b.vx) < minX) b.vx = (b.vx >= 0 ? 1 : -1) * minX;
    const k = v / Math.hypot(b.vx, b.vy);
    b.vx *= k; b.vy *= k;
  }

  private hitBlocks() {
    const b = this.ball;
    for (let r = 0; r < ROWS; r++) {
      const y0 = this.rowY(r);
      if (b.y + BALL_R < y0 || b.y - BALL_R > y0 + COURSE) continue;
      const rl = this.rowLeft(r), n = this.rowCols(r);
      const lo = Math.floor((b.x - BALL_R - rl) / BRICK);
      const hi = Math.floor((b.x + BALL_R - rl) / BRICK);
      for (let c = lo; c <= hi; c++) {
        if (c < 0 || c >= n || !this.alive[r * COLS_MAX + c]) continue;
        const cx = rl + (c + 0.5) * BRICK, cy = y0 + COURSE / 2;
        const px = BRICK / 2 + BALL_R - Math.abs(b.x - cx);
        const py = COURSE / 2 + BALL_R - Math.abs(b.y - cy);
        if (px <= 0 || py <= 0) continue;
        if (Math.abs(px - py) < 0.005) {
          // a corner: back the way it came, both ways
          b.vx = Math.sign(b.x - cx || 1) * Math.abs(b.vx);
          b.vy = Math.sign(b.y - cy || 1) * Math.abs(b.vy);
        } else if (px < py) {
          b.x = cx + Math.sign(b.x - cx || 1) * (BRICK / 2 + BALL_R);
          b.vx = Math.sign(b.x - cx || 1) * Math.abs(b.vx);
        } else {
          b.y = cy + Math.sign(b.y - cy || 1) * (COURSE / 2 + BALL_R);
          b.vy = Math.sign(b.y - cy || 1) * Math.abs(b.vy);
        }
        this.destroy(r, c);
        return;
      }
    }
  }

  private destroy(row: number, col: number) {
    this.alive[row * COLS_MAX + col] = 0;
    this.score += this.points(row);
    if (this.score > this.best) { this.best = this.score; writeBest(this.best); }
    const rl = this.rowLeft(row), cx = rl + (col + 0.5) * BRICK, cy = this.rowY(row) + COURSE / 2;
    if (!this.reduce) this.spawnFlecks(cx, cy);
    let rowGone = true;
    for (let c = 0; c < this.rowCols(row); c++) if (this.alive[row * COLS_MAX + c]) { rowGone = false; break; }
    if (rowGone) {
      this.clearedRows += 1;
      const v = Math.hypot(this.ball.vx, this.ball.vy);
      const want = Math.min(SPEED_MAX, SPEED_0 + this.clearedRows * SPEED_PER_ROW);
      if (v > 1e-6 && want > v) { this.ball.vx *= want / v; this.ball.vy *= want / v; }
    }
    this.keepAngle();
    this.impact(K_BLOCK);
    if (this.alive.every(v => !v)) this.endRound(true);
  }

  private spawnFlecks(cx: number, cy: number) {
    let spawned = 0;
    const want = 3 + Math.floor(this.rng() * 3);
    for (const f of this.flecks) {
      if (spawned >= want) break;
      if (f.ttl > 0) continue;
      f.x = cx + (this.rng() - 0.5) * BRICK * 0.8;
      f.y = cy + (this.rng() - 0.5) * COURSE * 0.7;
      f.vx = (this.rng() - 0.5) * 0.10;
      f.vy = -0.02 - this.rng() * 0.05;
      f.r = 0.0032 + this.rng() * 0.0026;
      f.ttl = 0.42 + this.rng() * 0.18;
      spawned += 1;
    }
  }

  private tickFlecks(dt: number) {
    for (const f of this.flecks) {
      if (f.ttl <= 0) continue;
      f.ttl -= dt;
      f.vy -= 0.55 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.ttl <= 0) { f.ttl = 0; f.r = 0; }
    }
  }

  /** Paint comes off (and later back on) through the shader's wear noise; this only drives the amount. */
  private tickPaint(dt: number) {
    const rate = this.reduce ? 1e6 : 1000 / FLAKE_MS;
    let moving = false, wrote = false;
    for (let i = 0; i < this.paint.length; i++) {
      const target = this.alive[i];
      const now = this.paint[i];
      if (now === target) continue;
      moving = true;
      if (this.paintDelay[i] > 0) { this.paintDelay[i] -= dt; continue; }
      this.paint[i] = target > now ? Math.min(target, now + rate * dt) : Math.max(target, now - rate * dt);
      wrote = true;
    }
    if (wrote) this.writeBlocks();
    return moving;
  }

  private writeBlocks() {
    for (let i = 0; i < this.paint.length; i++) this.blockData[i * 4] = Math.round(this.paint[i] * 255);
    if (this.blockTex) this.blockTex.needsUpdate = true;
  }

  private puffAt(x: number, y: number, r: number, a: number, ms: number) {
    this.puff.x = x; this.puff.y = y; this.puff.r = r; this.puff.a = a; this.puff.ttl = ms; this.puff.dur = ms;
  }

  /* ---------- the tag ---------- */
  private radiusAt(s: number, seed: number) {
    const breathe = 0.90 + 0.12 * Math.sin(seed * 9.1 + s * 7.3) + 0.08 * Math.sin(seed * 3.7 + s * 17.0);
    return LINE_R * (0.72 + 0.55 * Math.exp(-s / 0.20)) * breathe;
  }
  /**
   * How hard the cap is pressed along a flight: heavy off the bounce, lighter as it goes, lighter still when the
   * ball is fast — and every so often the can sputters and the line skips for a hand's width. A pure function of
   * the flight's seed and the distance, so a replay skips in the same places.
   */
  private pressureAt(s: number, level: number, seed: number) {
    const x = s * 10.5 + seed * 3.3, i = Math.floor(x), f = x - i, e = f * f * (3 - 2 * f);
    const n = hash1(i, seed) * (1 - e) + hash1(i + 1, seed) * e;
    const t = Math.max(0, Math.min(1, (n - (0.76 - 0.018 * level)) / 0.14));
    const skip = t * t * (3 - 2 * t);
    return (0.72 + 0.28 * Math.exp(-s / 0.75)) * (1 - 0.03 * level) * (1 - 0.86 * skip);
  }

  /** Sprays the stretch s0..s1 of the flight that left (ax, ay) in direction (dx, dy). */
  private sprayFlight(ax: number, ay: number, dx: number, dy: number, s0: number, s1: number, seed: number, level: number, fresh: number) {
    if (s1 - s0 < 1e-5) return;
    const tag = this.tag!, r = this.renderer();
    const pieces = Math.max(1, Math.ceil((s1 - s0) / 0.035));
    for (let k = 0; k < pieces; k++) {
      const a = s0 + (s1 - s0) * (k / pieces), b = s0 + (s1 - s0) * ((k + 1) / pieces);
      tag.capsule(r, ax + dx * a, ay + dy * a, ax + dx * b, ay + dy * b, this.radiusAt(a, seed), this.radiusAt(b, seed),
        (this.pressureAt(a, level, seed) + this.pressureAt(b, level, seed)) / 2, seed, fresh, 0, 1, COAT, 1);
    }
    this.hasPaint = true;
  }

  /** The blot a bounce leaves, its satellites, and sometimes a run of paint. */
  private sprayImpact(x: number, y: number, kind: number, index: number, instant: boolean, fresh: number) {
    if (kind === K_LOST) return;
    const tag = this.tag!, r = this.renderer();
    const seed = hash1(index, 3.1) * 50 + 1;
    const size = (kind === K_BLOCK ? 2.1 : kind === K_WALL ? 1.9 : kind === K_PADDLE ? 1.2 : 1.4) * (0.8 + 0.5 * hash1(index, 1.7));
    const R = LINE_R * size;
    const soft = kind === K_PADDLE ? 0.4 : 1;
    tag.capsule(r, x, y, x, y, R, R, 1, seed, fresh, 0, soft, 0.5, 1.5 * soft);
    // the heart of the blot, where the cone sat longest: this is the beat that stays
    if (kind !== K_PADDLE) tag.capsule(r, x, y, x, y, R * 0.55, R * 0.55, 1, seed + 1, fresh, 0, 0, 0.45, 0);
    const sat = kind === K_PADDLE ? 0 : 1 + Math.floor(hash1(index, 5.3) * 3);
    for (let k = 0; k < sat; k++) {
      const a = hash1(index, 7 + k) * Math.PI * 2, d = R * (1.35 + hash1(index, 11 + k) * 1.9), rr = LINE_R * (0.16 + hash1(index, 17 + k) * 0.3);
      tag.capsule(r, x + Math.cos(a) * d, y + Math.sin(a) * d, x + Math.cos(a) * d, y + Math.sin(a) * d, rr, rr, 0.9, seed + k, fresh, 0, 0.3, 0.6, 0);
    }
    const chance = kind === K_BLOCK ? 0.22 : kind === K_WALL ? 0.18 : kind === K_PADDLE ? 0.05 : 0;
    if (hash1(index, 23.9) < chance) {
      const len = 0.04 + hash1(index, 29.3) * 0.10, dx = x + (hash1(index, 31.7) - 0.5) * R * 0.8, dr = LINE_R * (0.45 + hash1(index, 37.1) * 0.22);
      const slot = instant || this.reduce ? undefined : this.drips.find(d => !d.on);
      if (slot) { slot.on = true; slot.x = dx; slot.y = y - R * 0.5; slot.len = len; slot.r = dr; slot.t = 0; slot.dur = 1.4 + len * 14; slot.drawn = 0; slot.seed = seed; }
      else {
        tag.capsule(r, dx, y - R * 0.5, dx, y - R * 0.5 - len, dr, dr * 0.8, 0.95, seed, fresh, 0, 0.2, 0.85, 0);
        tag.capsule(r, dx, y - R * 0.5 - len, dx, y - R * 0.5 - len, dr * 1.3, dr * 1.3, 1, seed, fresh, 0, 0.2, 0.85, 0);
      }
    }
    this.hasPaint = true;
  }

  private qx(x: number) { return Math.max(0, Math.min(65535, Math.round(((x - this.rect.x) / this.rect.w) * 65535))); }
  private qy(y: number) { return Math.max(0, Math.min(65535, Math.round(((y - this.rect.y) / this.rect.h) * 65535))); }
  private ux(q: number) { return this.rect.x + (q / 65535) * this.rect.w; }
  private uy(q: number) { return this.rect.y + (q / 65535) * this.rect.h; }
  private get speedLevel() {
    const v = Math.hypot(this.ball.vx, this.ball.vy);
    return Math.max(0, Math.min(15, Math.round((v - SPEED_0) / SPEED_PER_ROW)));
  }

  /** The ball touched something (or was launched, or lost): the line gets a vertex and the wall a blot. */
  private impact(kind: number) {
    const x = this.ball.x, y = this.ball.y;
    if (this.penDown) this.penTo(x, y);
    const index = this.tagN;
    if (this.tagN < TAG_MAX) {
      this.tagPts[this.tagN * 2] = this.qx(x);
      this.tagPts[this.tagN * 2 + 1] = this.qy(y);
      this.tagKind[this.tagN] = kind | (this.speedLevel << 3);
      this.tagN += 1;
    }
    this.sprayImpact(x, y, kind, index, false, 1);
    this.penDown = kind !== K_LOST;
    this.penAx = x; this.penAy = y; this.penS = 0;
    this.penSeed = hash1(index, 0.7) * 40 + 1;
  }

  /** Lay down the line from where the pen stopped to the ball. */
  private penTo(x: number, y: number) {
    if (!this.penDown) return;
    const dx = x - this.penAx, dy = y - this.penAy;
    const s = Math.hypot(dx, dy);
    if (s - this.penS < 0.004) return;
    this.sprayFlight(this.penAx, this.penAy, dx / s, dy / s, this.penS, s, this.penSeed, this.speedLevel, 1);
    this.penS = s;
  }

  /** Re-sprays stored points [from, to) — after a reload, or a lost GL context. */
  private replay(from: number, to: number) {
    for (let i = from; i < to; i++) {
      // the last strokes of a piece never had time to settle
      const fresh = i >= this.tagN - 5 ? 0.55 : 0;
      const kind = this.tagKind[i] & 7, level = this.tagKind[i] >> 3;
      const x = this.ux(this.tagPts[i * 2]), y = this.uy(this.tagPts[i * 2 + 1]);
      if (i > 0 && kind !== K_START) {
        const ax = this.ux(this.tagPts[i * 2 - 2]), ay = this.uy(this.tagPts[i * 2 - 1]);
        const s = Math.hypot(x - ax, y - ay);
        if (s > 1e-5) this.sprayFlight(ax, ay, (x - ax) / s, (y - ay) / s, 0, s, hash1(i - 1, 0.7) * 40 + 1, level, fresh);
      }
      this.sprayImpact(x, y, kind, i, true, fresh);
    }
  }

  private clearTag(keepPoints: boolean) {
    this.tag?.clear();
    this.jobs.length = 0;
    for (const d of this.drips) d.on = false;
    this.hasPaint = false;
    this.replayAt = -1;
    if (!keepPoints) { this.tagN = 0; this.tagSigned = 0; }
    this.penDown = false;
  }

  /** Everything still being sprayed lands at once (a new round is starting, or the context came back). */
  private finishJobs() {
    if (this.replayAt >= 0) { this.replay(this.replayAt, this.tagN); this.replayAt = -1; if (this.tagSigned) this.sign(this.tagSigned, true); }
    for (const j of this.jobs) { if (j.halo) this.haloJob(j); else this.sprayJob(j, j.s, j.total); }
    this.jobs.length = 0;
    for (const d of this.drips) if (d.on) { this.sprayDrip(d, d.len); d.on = false; }
  }

  private sprayDrip(d: WallGame['drips'][number], to: number) {
    const tag = this.tag!, r = this.renderer();
    tag.capsule(r, d.x, d.y - d.drawn, d.x, d.y - to, d.r, d.r * 0.85, 0.95, d.seed, 1, 0, 0.2, 0.85, 0);
    if (to >= d.len) tag.capsule(r, d.x, d.y - d.len, d.x, d.y - d.len, d.r * 1.3, d.r * 1.3, 1, d.seed, 1, 0, 0.2, 0.85, 0);
    d.drawn = to;
  }

  /** Clears a dark outline for a stroke out of whatever is on the wall, before the stroke itself goes on. */
  private haloJob(j: StrokeJob) {
    const tag = this.tag!, r = this.renderer();
    tag.erase(r, true);
    this.sprayJob(j, 0, j.total, j.halo, true);
    tag.erase(r, false);
    j.halo = 0;
  }

  private sprayJob(j: StrokeJob, s0: number, s1: number, widen = 1, erasing = false) {
    if (s1 <= s0) return;
    const tag = this.tag!, r = this.renderer(), p = j.pts;
    let run = 0;
    for (let i = 2; i < p.length; i += 2) {
      const ax = p[i - 2], ay = p[i - 1], bx = p[i], by = p[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      const a = Math.max(s0, run), b = Math.min(s1, run + len);
      if (b > a && len > 1e-6) {
        const ta = (a - run) / len, tb = (b - run) / len;
        const ra = j.radius * widen * this.taperAt(j.taper, a / j.total), rb = j.radius * widen * this.taperAt(j.taper, b / j.total);
        if (erasing) tag.capsule(r, ax + (bx - ax) * ta, ay + (by - ay) * ta, ax + (bx - ax) * tb, ay + (by - ay) * tb, ra, rb, 0.9, j.seed, 1, 1, 0.9, 1, 0);
        else tag.capsule(r, ax + (bx - ax) * ta, ay + (by - ay) * ta, ax + (bx - ax) * tb, ay + (by - ay) * tb, ra, rb, 1, j.seed, 1, 1, 0.8, 0, 0.55);
      }
      run += len;
      if (run >= s1) break;
    }
    this.hasPaint = true;
  }

  /** 0 = an even fat-cap stroke, 1 = a swoosh that thins out, 2 = a sparkle ray (thin-fat-thin). */
  private taperAt(mode: number, u: number) {
    const ends = Math.min(1, 0.5 + u * 8) * Math.min(1, 0.5 + (1 - u) * 8);
    if (mode === 1) return (1.15 - 0.72 * u) * ends;
    if (mode === 2) return 0.18 + 0.82 * Math.pow(Math.sin(Math.PI * u), 1.6);
    return ends;
  }

  private addJob(points: Pt[], radius: number, taper: number, speed: number, delay: number, instant: boolean, halo = 0) {
    const pts = new Float32Array(points.length * 2);
    let total = 0;
    points.forEach((q, i) => { pts[i * 2] = q[0]; pts[i * 2 + 1] = q[1]; if (i) total += Math.hypot(q[0] - points[i - 1][0], q[1] - points[i - 1][1]); });
    const job: StrokeJob = { pts, total, radius, taper, seed: 3 + this.jobs.length * 7.3 + radius * 100, speed, s: 0, delay, halo };
    if (instant) { if (halo) this.haloJob(job); else this.sprayJob(job, 0, total); } else this.jobs.push(job);
  }

  private sparkle(x: number, y: number, size: number, delay: number, instant: boolean) {
    this.addJob([[x, y + size], [x, y - size]], LINE_R * 1.5, 2, 3.2, delay, instant);
    this.addJob([[x - size * 0.72, y], [x + size * 0.72, y]], LINE_R * 1.5, 2, 3.2, delay + 60, instant);
  }

  /**
   * Signing the finished piece: an underline swoosh with a flick back and a sparkle, under the paddle zone.
   * A cleared wall also gets the crown — fat cap, over everything — and sparkles scattered through the tag.
   */
  private sign(level: number, instant: boolean, short = false) {
    const l = this.left, r = this.right, w = r - l;
    const x0 = l + 0.66, x1 = r - 0.86, y = 1.262;
    this.addJob(smooth([[x0 - 0.02, y + 0.012], [x0 + 0.05, y + 0.046], [x0 + w * 0.2, y + 0.022], [x0 + w * 0.45, y + 0.006], [x1 - 0.2, y + 0.006], [x1, y + 0.03]], 8), LINE_R * 1.75, 1, 5.6, 260, instant);
    if (!short) this.addJob(smooth([[x1, y + 0.03], [x1 - w * 0.10, y - 0.02], [x1 - w * 0.30, y - 0.046]], 6), LINE_R * 1.3, 1, 5.6, 300, instant);
    this.sparkle(x1 + 0.13, y + 0.035, 0.105, short ? 200 : 420, instant);
    if (level < 2) return;
    // the crown: three points, outer ones leaning out, a band under it; then the shines around it
    const cx = this.centreX, by = 2.09, cw = Math.min(0.92, w * 0.36), ch = 0.36, fatR = LINE_R * 2.7;
    // first the outline: the tag under the crown is taken back, so the crown sits ON the piece, not in it
    this.addJob([[cx - cw / 2, by - 0.085], [cx - cw / 2, by], [cx - cw * 0.60, by + ch * 0.74], [cx - cw * 0.24, by + ch * 0.30], [cx, by + ch], [cx + cw * 0.24, by + ch * 0.30], [cx + cw * 0.60, by + ch * 0.74], [cx + cw / 2, by], [cx + cw / 2, by - 0.085], [cx - cw / 2, by - 0.085], [cx + cw / 2, by - 0.04], [cx - cw / 2, by - 0.02]], fatR, 0, 99, 500, instant, 2.2);
    this.addJob([[cx - cw / 2, by], [cx - cw * 0.60, by + ch * 0.74], [cx - cw * 0.24, by + ch * 0.30], [cx, by + ch], [cx + cw * 0.24, by + ch * 0.30], [cx + cw * 0.60, by + ch * 0.74], [cx + cw / 2, by], [cx - cw / 2 + 0.01, by + 0.004]], fatR, 0, 4.6, 520, instant);
    this.addJob([[cx - cw / 2 + 0.01, by - 0.085], [cx + cw / 2 - 0.005, by - 0.078]], fatR * 0.9, 0, 4.6, 560, instant);
    for (let k = 0; k < 5; k++) {
      const a = Math.PI * (0.16 + 0.17 * k), r0 = cw * 0.80, r1 = cw * (k % 2 ? 0.98 : 1.06);
      this.addJob([[cx + Math.cos(a) * r0, by + 0.05 + Math.sin(a) * r0 * 0.62], [cx + Math.cos(a) * r1, by + 0.05 + Math.sin(a) * r1 * 0.62]], LINE_R * 1.25, 2, 2.6, 900 + k * 70, instant);
    }
    const n = this.tagN;
    for (let k = 0; k < 4; k++) {
      const sx = l + w * (0.10 + 0.8 * hash1(n, 41 + k)), sy = DEATH_Y + 0.2 + (BLOCKS_Y1 - DEATH_Y - 0.3) * hash1(n, 53 + k);
      if (Math.abs(sx - cx) < cw * 1.15 && sy > by - 0.45) continue;
      this.sparkle(sx, sy, 0.06 + 0.07 * hash1(n, 61 + k), 760 + k * 120, instant);
    }
  }

  /** Advances whatever is still being sprayed. Returns true while it needs frames. */
  private tickTag(now: number, dt: number) {
    let active = false;
    if (this.restamp) {
      // a restored context: everything back at once, already settled
      this.restamp = false;
      this.hasPaint = false;
      this.replay(0, this.tagN);
      if (this.tagSigned) this.sign(this.tagSigned, true);
      this.penS = 0;
      active = true;
    }
    if (this.replayAt >= 0) {
      // the returning visitor's piece goes back up in about a second
      const chunk = this.reduce ? this.tagN : Math.max(2, Math.ceil(this.tagN / 55));
      const to = Math.min(this.tagN, this.replayAt + chunk);
      this.replay(this.replayAt, to);
      this.replayAt = to;
      if (to >= this.tagN) { this.replayAt = -1; if (this.tagSigned) this.sign(this.tagSigned, true); }
      active = true;
    }
    for (const d of this.drips) {
      if (!d.on) continue;
      d.t += dt;
      const u = Math.min(1, d.t / d.dur);
      this.sprayDrip(d, d.len * (1 - Math.pow(1 - u, 3)));
      if (u >= 1) d.on = false;
      active = true;
    }
    if (this.jobs.length) {
      active = true;
      // one stroke at a time per hand, but a job's delay lets the sparkles overlap the swoosh
      for (let i = 0; i < this.jobs.length; i++) {
        const j = this.jobs[i];
        if (j.delay > 0) { j.delay -= dt * 1000; continue; }
        if (j.halo) { this.haloJob(j); this.jobs.splice(i, 1); i--; continue; }
        const to = Math.min(j.total, j.s + j.speed * dt);
        this.sprayJob(j, j.s, to);
        j.s = to;
        if (to >= j.total) { this.jobs.splice(i, 1); i--; }
      }
    }
    return active;
  }

  /* ---------- persistence: the visitor's last tag ---------- */
  private saveTag() {
    if (!this.built) return;
    try {
      const n = this.tagN;
      if (!n) { localStorage.removeItem(TAG_KEY); return; }
      const bytes = new Uint8Array(n * 5);
      for (let i = 0; i < n; i++) {
        bytes[i * 5] = this.tagPts[i * 2] >> 8; bytes[i * 5 + 1] = this.tagPts[i * 2] & 255;
        bytes[i * 5 + 2] = this.tagPts[i * 2 + 1] >> 8; bytes[i * 5 + 3] = this.tagPts[i * 2 + 1] & 255;
        bytes[i * 5 + 4] = this.tagKind[i];
      }
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      localStorage.setItem(TAG_KEY, JSON.stringify({ v: 1, c: this.cols, s: this.tagSigned, p: this.score, d: btoa(bin) }));
    } catch { /* storage blocked or full: the tag simply does not survive the reload */ }
  }

  private loadTag() {
    try {
      localStorage.removeItem('hall.wall-game.tag.v1');
      const raw = localStorage.getItem(TAG_KEY);
      if (!raw || raw.length > 6000) return;
      const o = JSON.parse(raw) as { v?: number; c?: number; s?: number; p?: number; d?: string };
      if (o.v !== 1 || typeof o.d !== 'string' || o.c !== this.cols) return;
      const bin = atob(o.d);
      const n = Math.min(TAG_MAX, Math.floor(bin.length / 5));
      for (let i = 0; i < n; i++) {
        this.tagPts[i * 2] = (bin.charCodeAt(i * 5) << 8) | bin.charCodeAt(i * 5 + 1);
        this.tagPts[i * 2 + 1] = (bin.charCodeAt(i * 5 + 2) << 8) | bin.charCodeAt(i * 5 + 3);
        this.tagKind[i] = bin.charCodeAt(i * 5 + 4);
      }
      this.tagN = n;
      this.tagSigned = o.s === 1 || o.s === 2 ? o.s : 0;
      if (this.tagSigned && Number.isFinite(o.p)) this.score = Math.max(0, Math.min(999, Math.round(o.p!)));
      if (n) this.replayAt = 0;
    } catch { this.tagN = 0; }
  }

  /* ---------- uniforms ---------- */
  private setSlot(slot: number, cell: Cell | null, id: number, x: number, y: number, h: number) {
    const rect = this.u.wallGameGlyphRect.value[slot], uv = this.u.wallGameGlyphUv.value[slot];
    if (!cell) { rect.set(0, 0, 0, 0); this.slotCell[slot] = -1; return; }
    const w = h * cell.w / cell.h;
    rect.set(x, y, w, h);
    uv.set(cell.x / ATLAS_W, 1 - (cell.y + cell.h) / ATLAS_H, cell.w / ATLAS_W, cell.h / ATLAS_H);
    if (this.slotCell[slot] !== id) {
      // what the slot shows has changed: spray the new mark on rather than swapping it like a display
      if (this.slotCell[slot] !== -2 && !this.reduce) this.slotInk[slot] = 0;
      this.slotCell[slot] = id;
    }
  }

  private tickHud(dt: number) {
    let moving = false;
    for (let i = 0; i < this.slotInk.length; i++) {
      if (this.slotInk[i] >= 1) continue;
      this.slotInk[i] = Math.min(1, this.slotInk[i] + dt * 1000 / INK_MS);
      moving = true;
    }
    return moving;
  }

  /** Placement that only changes with the layout. */
  private writeStatics() {
    this.u.wallGameGrid.value.set(this.left, BLOCKS_Y0, this.parity, this.cols);
    this.u.wallGameLight.value.set(this.centreX, this.lampY, this.cols * BRICK / 2 + WALL_GAME_LAMP_OVERHANG, LAMP_THROW);
  }

  private writeUniforms() {
    const u = this.u;
    // score, left: up to three digits, a hand's advance apart
    const digitAdvance = SCORE_CELL * 0.60, bestAdvance = BEST_CELL * 0.60;
    const s = String(Math.min(999, this.score));
    for (let i = 0; i < 3; i++) {
      const d = i < s.length ? s.charCodeAt(i) - 48 : -1;
      this.setSlot(G_SCORE + i, d < 0 ? null : CELLS.digit(d), d, this.left - 0.035 + i * digitAdvance, HUD_Y, SCORE_CELL);
    }
    // best, right-aligned, under its crown
    const b = String(Math.min(9999, this.best));
    const bw = BEST_CELL * DIGIT_CELL_W / DIGIT_CELL_H;
    const bx = this.right + 0.03 - bw - (b.length - 1) * bestAdvance;
    for (let i = 0; i < 4; i++) {
      const d = i < b.length ? b.charCodeAt(i) - 48 : -1;
      this.setSlot(G_BEST + i, d < 0 ? null : CELLS.digit(d), d, bx + i * bestAdvance, HUD_Y + 0.012, BEST_CELL);
    }
    const crownH = 0.20;
    this.setSlot(G_CROWN, CELLS.crown, 100, bx - crownH * CELLS.crown.w / CELLS.crown.h + 0.035, HUD_Y + 0.030, crownH);
    for (let i = 0; i < LIVES; i++) {
      const lost = i >= this.lives;
      this.setSlot(G_LIVES + i, lost ? CELLS.cross : CELLS.dot, lost ? 102 : 101, this.left + 0.01 + i * LIVES_CELL * 0.92, LIVES_Y, LIVES_CELL);
    }
    const iconH = this.tagSigned === 2 ? ICON_H_CROWNED : ICON_H, iconY = this.tagSigned === 2 ? ICON_Y_CROWNED : ICON_Y;
    const iconW = iconH * CELLS.icon.w / CELLS.icon.h;
    this.setSlot(G_ICON, this.mode === 'idle' ? CELLS.icon : null, 103, this.centreX - iconW / 2 + 0.02, iconY - iconH / 2, iconH);
    const sr = this.stopRect;
    this.setSlot(G_STOP, this.playing ? CELLS.stop : null, 105, sr.x, sr.y, sr.h);
    const canW = CELLS.can.w / CAN_PX_PER_M, canH = CELLS.can.h / CAN_PX_PER_M;
    this.setSlot(G_CAN, CELLS.can, 104, this.paddleX + this.shake - PADDLE_HW - 30 / CAN_PX_PER_M, PADDLE_Y - canH / 2, canH);
    void canW;
    for (let i = 0; i < this.slotInk.length; i++) u.wallGameGlyphInk.value[i] = i === G_ICON ? this.iconInk * this.slotInk[i] : this.slotInk[i];
    u.wallGameBall.value.set(this.ball.x + this.shake * 0.5, this.ball.y, BALL_R);
    for (let i = 0; i < u.wallGameFlecks.value.length; i++) {
      const f = this.flecks[i];
      u.wallGameFlecks.value[i].set(f ? f.x : 0, f ? f.y : 0, f && f.ttl > 0 ? f.r * Math.min(1, f.ttl * 6) : 0);
    }
    const p = this.puff;
    if (p.ttl > 0) {
      const k = 1 - p.ttl / p.dur;
      u.wallGamePuff.value.set(p.x + k * 0.05, p.y + k * 0.015, p.r * (0.45 + 0.75 * Math.sqrt(k)), p.a * (1 - k) * (1 - k));
    } else u.wallGamePuff.value.w = 0;
  }

  /* ---------- sprayed once: the frame marks ---------- */
  private drawMask() {
    const canvas = this.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const scale = W / this.rect.w;
    const P = (x: number, y: number): Pt => [((x - this.rect.x) / this.rect.w) * W, ((this.rect.y + this.rect.h - y) / this.rect.h) * H];
    ctx.clearRect(0, 0, W, H);
    const rng = mulberry(5711 + this.cols);
    const l = this.left, r = this.right, w = r - l, fat = 0.030 * scale;
    const top = PLAY_TOP + 0.026, lx = l - 0.020, rx = r + 0.020, foot = DEATH_Y - 0.04;

    // The boundaries the ball bounces off are fat-cap marks with the weight of the wall's lettering — never a
    // closed box. Two brackets hold the block rows and thin out towards the middle of the top edge. The sides
    // come up out of a foot at the bottom corners as arrows: play goes that way. Left and right are different
    // hands: chevrons climbing on the left, a wavy foot, a cross and a sparkle on the right. Nothing reaches
    // further out than FRAME_OUT, so the window rule in hallScene can trust it.
    spray(ctx, [P(l + w * 0.46, top + 0.012), P(l + w * 0.2, top + 0.004), P(lx + 0.04, top), P(lx, top - 0.04), P(lx + 0.006, top - 0.54)], fat, { rng, wobble: 1.8, taper: [0.30, 1.1] });
    spray(ctx, [P(r - w * 0.40, top - 0.006), P(r - w * 0.18, top + 0.002), P(rx - 0.04, top + 0.006), P(rx, top - 0.04), P(rx - 0.005, top - 0.46)], fat, { rng, wobble: 1.8, taper: [0.30, 1.1] });
    drip(ctx, ...P(lx + 0.008, top - 0.545), 0.12 * scale, fat * 0.36, rng);
    drip(ctx, ...P(rx - 0.006, top - 0.465), 0.06 * scale, fat * 0.34, rng);
    drip(ctx, ...P(l + 0.36, top - 0.016), 0.05 * scale, fat * 0.30, rng);

    // left: foot, shaft, arrowhead (the outer barb short, the inner one long), two chevrons climbing above it
    const tipL = DEATH_Y + 0.62;
    spray(ctx, [P(l + 0.40, foot - 0.010), P(lx + 0.04, foot), P(lx, foot + 0.04), P(lx + 0.004, tipL)], fat, { rng, wobble: 1.6, taper: [0.6, 1.05] });
    spray(ctx, [P(lx - 0.032, tipL - 0.075), P(lx + 0.002, tipL + 0.018), P(lx + 0.135, tipL - 0.135)], fat * 0.96, { rng, wobble: 0.8 });
    for (const [y, p] of [[tipL + 0.19, 0.95], [tipL + 0.34, 0.78]] as [number, number][]) {
      spray(ctx, [P(lx - 0.030, y - 0.068), P(lx + 0.004, y + 0.012), P(lx + 0.115, y - 0.105)], fat * 0.86, { rng, wobble: 0.8, pressure: p });
    }

    // right: a foot that wobbles like a signature's tail, shaft, arrowhead, then a cross and a sparkle up the wall
    const tipR = DEATH_Y + 0.52;
    spray(ctx, smooth([P(r - 0.62, foot + 0.030), P(r - 0.52, foot - 0.030), P(r - 0.42, foot + 0.024), P(r - 0.32, foot - 0.018), P(r - 0.20, foot + 0.006), P(rx - 0.05, foot)], 8), fat * 0.92, { rng, wobble: 0.6, taper: [0.5, 1.05] });
    spray(ctx, [P(rx - 0.05, foot), P(rx, foot + 0.045), P(rx - 0.004, tipR)], fat, { rng, wobble: 1.6 });
    spray(ctx, [P(rx + 0.032, tipR - 0.075), P(rx - 0.002, tipR + 0.018), P(rx - 0.135, tipR - 0.135)], fat * 0.96, { rng, wobble: 0.8 });
    const xr = rx - 0.012, xy = tipR + 0.25;
    spray(ctx, [P(xr - 0.058, xy + 0.058), P(xr + 0.050, xy - 0.056)], fat * 0.84, { rng, taper: [1.1, 0.8] });
    spray(ctx, [P(xr + 0.050, xy + 0.062), P(xr - 0.060, xy - 0.052)], fat * 0.84, { rng, taper: [1.1, 0.8] });
    const sy = xy + 0.27;
    for (const [dx, dy] of [[0, 0.135], [0, -0.135], [-0.075, 0], [0.062, 0]]) spray(ctx, [P(xr, sy), P(xr + dx, sy + dy)], fat * 0.74, { rng, taper: [1.0, 0.22], speckle: 0.25 });
    drip(ctx, ...P(r - 0.30, foot - 0.012), 0.085 * scale, fat * 0.32, rng);
    drip(ctx, ...P(l + 0.17, foot - 0.014), 0.05 * scale, fat * 0.30, rng);

    // The score's underline: one fast stroke, thick where the hand came down, and a short second flick under it.
    const ux = l - 0.03, uy = HUD_Y - 0.004;
    spray(ctx, smooth([P(ux, uy - 0.014), P(ux + 0.25, uy - 0.006), P(ux + 0.52, uy + 0.010), P(ux + 0.72, uy + 0.034)], 8), fat * 0.95, { rng, taper: [1.25, 0.4], wobble: 0.8 });
    spray(ctx, smooth([P(ux + 0.10, uy - 0.066), P(ux + 0.30, uy - 0.060), P(ux + 0.47, uy - 0.044)], 6), fat * 0.62, { rng, taper: [1.1, 0.35], wobble: 0.6 });

    wear(ctx, W, H, 8831);
    if (this.maskTex) this.maskTex.needsUpdate = true;
  }

  /* ---------- sprayed once: digits, the can, crown, lives, play mark ---------- */
  private drawAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_W;
    canvas.height = ATLAS_H;
    const ctx = canvas.getContext('2d')!;
    const rng = mulberry(90210);
    for (let d = 0; d < 10; d++) {
      const c = CELLS.digit(d);
      sprayGlyph(ctx, DIGIT_STROKES[d], c.x, c.y, c.h, 11.2, rng);
    }

    // The can, lying on its side, nozzle to the right: body with two bare bands, shoulder, cap, nozzle.
    {
      const c = CELLS.can, cy = c.y + c.h / 2, hh = PADDLE_HH * CAN_PX_PER_M;
      const x0 = c.x + 30, body = x0 + 340, shoulder = body + 34, cap = shoulder + 36, tip = c.x + 456;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(x0 + 9, cy - hh);
      ctx.lineTo(body, cy - hh);
      ctx.quadraticCurveTo(body + 22, cy - hh, shoulder, cy - hh * 0.64);
      ctx.lineTo(cap, cy - hh * 0.64);
      ctx.lineTo(cap, cy - hh * 0.34);
      ctx.lineTo(tip, cy - hh * 0.34);
      ctx.lineTo(tip, cy + hh * 0.34);
      ctx.lineTo(cap, cy + hh * 0.34);
      ctx.lineTo(cap, cy + hh * 0.64);
      ctx.lineTo(shoulder, cy + hh * 0.64);
      ctx.quadraticCurveTo(body + 22, cy + hh, body, cy + hh);
      ctx.lineTo(x0 + 9, cy + hh);
      ctx.quadraticCurveTo(x0, cy + hh, x0, cy + hh - 9);
      ctx.lineTo(x0, cy - hh + 9);
      ctx.quadraticCurveTo(x0, cy - hh, x0 + 9, cy - hh);
      ctx.fill();
      // soften the silhouette with the can itself
      const edge: Pt[] = [[x0 + 6, cy - hh + 3], [body, cy - hh + 3], [shoulder, cy - hh * 0.64 + 3], [cap - 3, cy - hh * 0.64 + 3], [cap - 3, cy + hh * 0.64 - 3], [shoulder, cy + hh * 0.64 - 3], [body, cy + hh - 3], [x0 + 6, cy + hh - 3], [x0 + 4, cy - hh + 6]];
      spray(ctx, edge, 4.2, { rng, speckle: 0.5, wobble: 0.6 });
      // bare bands and the seam between shoulder and cap
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      ctx.fillRect(x0 + 50, cy - hh - 8, 16, hh * 2 + 16);
      ctx.fillRect(x0 + 262, cy - hh - 8, 16, hh * 2 + 16);
      ctx.fillRect(shoulder - 3, cy - hh - 8, 7, hh * 2 + 16);
      ctx.globalCompositeOperation = 'source-over';
    }

    // The play mark: outlined with the fat cap, filled in with quick diagonal passes.
    {
      const c = CELLS.icon, cx = c.x + c.w / 2, cy = c.y + c.h / 2, hw = 50;
      const a: Pt = [cx - hw * 0.72, cy - hw], b: Pt = [cx - hw * 0.78, cy + hw], tip: Pt = [cx + hw * 1.08, cy + 3];
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(a[0] - 4, a[1] - 6); ctx.lineTo(tip[0] + 8, tip[1]); ctx.lineTo(b[0] - 4, b[1] + 6); ctx.closePath();
      ctx.clip();
      for (let k = 0; k < 11; k++) {
        const y = a[1] + (b[1] - a[1]) * (k + 0.5) / 11;
        spray(ctx, [[a[0] - 6, y + 8], [tip[0], y - 10]], 8.4, { rng, pressure: 0.95, speckle: 0.2, wobble: 1.0 });
      }
      ctx.restore();
      spray(ctx, [a, tip, b, [a[0] - 1, a[1] - 6]], 8.6, { rng, wobble: 1.0, taper: [1.1, 0.9] });
      // one loose turn of the arm around it, overshooting where it closes
      const ring: Pt[] = [];
      for (let k = 0; k <= 46; k++) {
        const t = -2.2 + (k / 46) * Math.PI * 2.32;
        const rr = 104 + 5 * Math.sin(t * 2 + 1) - k * 0.16;
        ring.push([cx + Math.cos(t) * rr * 1.02, cy + Math.sin(t) * rr * 0.98]);
      }
      spray(ctx, ring, 9.4, { rng, wobble: 1.4, taper: [1.15, 0.55] });
      drip(ctx, cx - 38, cy + 101, 26, 3.6, rng);
    }

    // The crown over the best score: three points, one line, and three shines.
    {
      const c = CELLS.crown, mx = 34, top = 46, bottom = 24, w = c.w - mx * 2, h = c.h - top - bottom, X = (u: number) => c.x + mx + u * w, Y = (v: number) => c.y + c.h - bottom - v * h;
      spray(ctx, [[X(0.06), Y(0)], [X(-0.02), Y(0.80)], [X(0.27), Y(0.38)], [X(0.5), Y(1)], [X(0.73), Y(0.38)], [X(1.02), Y(0.80)], [X(0.94), Y(0)], [X(0.02), Y(-0.02)]], 9.0, { rng, wobble: 0.7 });
      for (const [u, v, du, dv] of [[0.5, 1.16, 0, 0.26], [-0.10, 0.98, -0.12, 0.2], [1.10, 0.98, 0.12, 0.2]]) spray(ctx, [[X(u), Y(v)], [X(u + du), Y(v + dv)]], 5.4, { rng, taper: [1.1, 0.5], speckle: 0.2 });
    }
    // A life: a fat dot. A lost one: crossed out.
    {
      const d = CELLS.dot, x = CELLS.cross;
      spray(ctx, [[d.x + d.w / 2, d.y + d.h / 2]], 31, { rng, speckle: 1.6 });
      spray(ctx, [[x.x + 22, x.y + 22], [x.x + x.w - 22, x.y + x.h - 22]], 10.5, { rng, taper: [1.1, 0.8] });
      spray(ctx, [[x.x + x.w - 22, x.y + 20], [x.x + 24, x.y + x.h - 22]], 10.5, { rng, taper: [1.1, 0.8] });
    }
    // The stop mark: a small filled square, outlined with the fat cap and filled with two quick passes.
    {
      const c = CELLS.stop, m = 20, x0 = c.x + m, y0 = c.y + m, x1 = c.x + c.w - m, y1 = c.y + c.h - m;
      ctx.save();
      ctx.beginPath(); ctx.rect(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6); ctx.clip();
      for (let k = 0; k < 5; k++) { const y = y0 + (y1 - y0) * (k + 0.5) / 5; spray(ctx, [[x0 - 6, y + 4], [x1 + 6, y - 4]], 8.2, { rng, pressure: 0.95, speckle: 0.2, wobble: 0.8 }); }
      ctx.restore();
      spray(ctx, [[x0, y0], [x1, y0 + 2], [x1 - 1, y1], [x0 + 1, y1 - 1], [x0 - 1, y0 - 4]], 8.6, { rng, wobble: 0.9, taper: [1.1, 0.9] });
    }
    wear(ctx, ATLAS_W, ATLAS_H, 1377, 0.9);
    return canvas;
  }

  /* ---------- dev / QA ---------- */
  /** Reads the tag target back (slow; QA only). */
  debugCoverage() { return this.tag ? this.tag.debugCoverage(this.renderer()) : null; }
  debugAtlas() { return (this.atlasTex?.image as HTMLCanvasElement | undefined)?.toDataURL() ?? ''; }
  debugMask() { return this.canvas?.toDataURL() ?? ''; }
}
