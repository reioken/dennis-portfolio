import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface CatToy {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  held: boolean;
  bat: (direction: THREE.Vector3, strength?: number) => void;
}
type Toy = CatToy & { node: THREE.Group; model: THREE.Object3D; button: HTMLButtonElement; lastInput: number; ball: boolean; left: string; top: string };
export const BLUE_TOY_BUILD = 'v1';
export const TOY_GRAVITY = 3.5;

/** Two small rigid bodies with fixed-step floor/contact physics. No physics engine or frame allocations. */
export class BlueToys {
  readonly root = new THREE.Group();
  private toys: Toy[] = [];
  private accumulator = 0;
  private clock = 0;
  private enabled = false;
  private reduce = false;
  private compact = false;
  private point = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private rotation = new THREE.Quaternion();
  private disposed = false;
  private camera?: THREE.Camera;
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private plane = new THREE.Plane();
  private drag: { toy: Toy; id: number; x: number; y: number; moved: boolean; lastAt: number; last: THREE.Vector3; velocity: THREE.Vector3; offset: THREE.Vector3 } | null = null;

  constructor(private container: HTMLElement, private play: (toy: CatToy) => void) {}

  add(gltf: GLTF, ball: boolean) {
    if (this.disposed) return;
    const model = gltf.scene, node = new THREE.Group();
    node.add(model); this.root.add(node);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'hall__blue-toy'; button.hidden = true;
    const radius = ball ? .055 : .06;
    const toy: Toy = { node, model, position: node.position, velocity: new THREE.Vector3(), radius, held: false, button, ball, left: '', top: '', lastInput: -10, bat: (direction, strength = .9) => { if (!toy.held) this.impulse(toy, direction, strength); } };
    node.position.set(ball ? -2.16 : -1.02, radius, ball ? .43 : .47);
    if (this.container.clientWidth < 600) node.position.set(ball ? -1.18 : -.78, radius, ball ? .59 : .45);
    button.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !this.enabled || this.drag || !this.camera) return;
      e.stopPropagation(); e.preventDefault();
      // The 44px touch targets overlap when two small toys touch. Pick the
      // nearest visible centre, rather than whichever button was appended last.
      const toy = this.toys.filter(t => !t.button.hidden).reduce((best, t) => {
        const distance = (item: Toy) => { const r = item.button.getBoundingClientRect(); return Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2); };
        return distance(t) < distance(best) ? t : best;
      });
      const button = toy.button;
      toy.held = true; toy.velocity.set(0, 0, 0);
      this.root.updateWorldMatrix(true, false);
      // A vertical plane through the toy maps the pointer directly to lift and sideways travel.
      this.plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), toy.node.getWorldPosition(this.point));
      const local = this.pointerPoint(e);
      const offset = toy.position.clone().sub(local ?? toy.position);
      this.drag = { toy, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, lastAt: e.timeStamp, last: toy.position.clone(), velocity: new THREE.Vector3(), offset };
      button.setPointerCapture(e.pointerId); button.classList.add('is-held');
      if (!this.reduce) this.play(toy);
    });
    button.addEventListener('pointermove', e => this.dragMove(e));
    button.addEventListener('pointerup', e => this.release(e, false));
    button.addEventListener('pointercancel', e => this.release(e, true));
    button.addEventListener('lostpointercapture', e => this.release(e, true));
    button.addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0) this.nudge(toy, 0); });
    this.container.append(button); this.toys.push(toy);
    this.toys.sort((a, b) => Number(b.ball) - Number(a.ball));
  }

  private pointerPoint(e: PointerEvent) {
    if (!this.camera) return null;
    const rect = this.container.getBoundingClientRect();
    this.pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, 1 - (e.clientY - rect.top) / rect.height * 2);
    this.ray.setFromCamera(this.pointer, this.camera);
    if (!this.ray.ray.intersectPlane(this.plane, this.point)) return null;
    return this.root.worldToLocal(this.point);
  }

  private dragMove(e: PointerEvent) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    e.stopPropagation(); e.preventDefault();
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) d.moved = true;
    if (!d.moved) return;
    const p = this.pointerPoint(e); if (!p) return;
    p.add(d.offset);
    p.x = THREE.MathUtils.clamp(p.x, this.compact ? -1.32 : -2.24, this.compact ? .28 : 1.6);
    p.y = THREE.MathUtils.clamp(p.y, d.toy.radius, this.reduce ? .12 : 1.65);
    const dt = Math.max(.008, (e.timeStamp - d.lastAt) / 1000);
    this.direction.subVectors(p, d.last).divideScalar(dt);
    d.velocity.lerp(this.direction, 1 - Math.exp(-dt * 24));
    d.toy.position.copy(p); d.last.copy(p); d.lastAt = e.timeStamp;
  }

  private release(e: PointerEvent, cancelled: boolean) {
    const d = this.drag; if (!d || e.pointerId !== d.id) return;
    e.stopPropagation(); e.preventDefault();
    this.drag = null; d.toy.held = false; d.toy.button.classList.remove('is-held');
    if (d.toy.button.hasPointerCapture(d.id)) d.toy.button.releasePointerCapture(d.id);
    if (cancelled) { d.toy.velocity.set(0, 0, 0); return; }
    if (!d.moved) { this.nudge(d.toy, e.clientX - d.x); return; }
    const recent = Math.exp(-Math.max(0, e.timeStamp - d.lastAt - 35) / 75);
    d.toy.velocity.copy(d.velocity).multiplyScalar(recent * .9);
    d.toy.velocity.x = THREE.MathUtils.clamp(d.toy.velocity.x, -2.6, 2.6);
    d.toy.velocity.y = THREE.MathUtils.clamp(d.toy.velocity.y, -2, 3.2);
    d.toy.velocity.z = .12;
    if (this.reduce) { d.toy.position.y = d.toy.radius; d.toy.velocity.clampLength(0, .18); d.toy.velocity.y = 0; }
    else this.play(d.toy);
  }

  private nudge(toy: Toy, side: number) {
    if (!this.enabled || this.clock - toy.lastInput < .16) return;
    toy.lastInput = this.clock;
    this.direction.set(-1.38 - toy.position.x - side * .014, 0, .56 - toy.position.z);
    if (this.direction.lengthSq() < .001) this.direction.set(.3, 0, .2);
    this.impulse(toy, this.direction, .7);
    if (!this.reduce) this.play(toy);
  }

  private impulse(toy: Toy, direction: THREE.Vector3, strength: number) {
    this.direction.copy(direction); this.direction.y = 0; this.direction.normalize();
    toy.velocity.addScaledVector(this.direction, this.reduce ? .14 : strength);
    toy.velocity.y = this.reduce ? 0 : toy.ball ? .48 : .22;
    const horizontal = Math.hypot(toy.velocity.x, toy.velocity.z);
    if (horizontal > 1.2) { toy.velocity.x *= 1.2 / horizontal; toy.velocity.z *= 1.2 / horizontal; }
  }

  update(dt: number, camera: THREE.Camera, visible: boolean, reduce: boolean, compact: boolean) {
    this.compact = compact;
    this.camera = camera;
    this.clock += dt; this.enabled = visible; this.reduce = reduce;
    // Hidden/paused scenes never build up simulation time.
    this.root.visible = visible;
    if (!visible) { this.accumulator = 0; if (this.drag) { this.drag.toy.held = false; this.drag.toy.button.classList.remove('is-held'); this.drag = null; } for (const t of this.toys) t.button.hidden = true; return; }
    this.accumulator += Math.min(dt, .05);
    while (this.accumulator >= 1 / 120) { this.step(1 / 120); this.accumulator -= 1 / 120; }
    this.root.updateWorldMatrix(true, true);
    const en = document.documentElement.dataset.lang === 'en';
    for (const t of this.toys) {
      t.node.getWorldPosition(this.point).project(camera);
      t.button.hidden = Math.abs(this.point.x) > .96 || Math.abs(this.point.y) > .92 || this.point.z < -1 || this.point.z > 1;
      const left = ((this.point.x * .5 + .5) * 100).toFixed(2), top = ((-this.point.y * .5 + .5) * 100).toFixed(2);
      if (left !== t.left) { t.left = left; t.button.style.left = `${left}%`; }
      if (top !== t.top) { t.top = top; t.button.style.top = `${top}%`; }
      const label = t.ball ? (en ? 'Nudge ball' : 'Ball anstupsen') : (en ? 'Nudge toy mouse' : 'Stoffmaus anstupsen');
      if (t.button.getAttribute('aria-label') !== label) t.button.setAttribute('aria-label', label);
    }
  }

  private step(dt: number) {
    for (const t of this.toys) {
      if (t.held) continue;
      const p = t.position, v = t.velocity;
      const speed = Math.hypot(v.x, v.z);
      v.y -= TOY_GRAVITY * dt; p.addScaledVector(v, dt);
      if (p.y < t.radius) { p.y = t.radius; v.y = Math.abs(v.y) > .12 ? -v.y * .3 : 0; }
      const damping = Math.exp(-(p.y > t.radius + .008 ? .12 : t.ball ? .9 : 1.8) * dt);
      v.x *= damping; v.z *= damping;
      // A modest play area in front of the bed, outside its bolster and cabinet lane.
      const minX = (this.compact ? -1.4 : -2.3) + t.radius, maxX = (this.compact ? .38 : 1.7) - t.radius, minZ = .30 + t.radius, maxZ = .85 - t.radius;
      if (p.x < minX || p.x > maxX) { p.x = THREE.MathUtils.clamp(p.x, minX, maxX); v.x *= -.5; }
      if (p.z < minZ || p.z > maxZ) { p.z = THREE.MathUtils.clamp(p.z, minZ, maxZ); v.z *= -.5; }
      // The padded bed is a solid obstacle, not a reset/teleport zone.
      const bx = p.x + 1.65, bz = p.z - .18, distance = Math.hypot(bx, bz), bedRadius = .37 + t.radius;
      if (distance < bedRadius && p.y < .23) {
        const nx = bx / Math.max(distance, .0001), nz = bz / Math.max(distance, .0001);
        p.x = -1.65 + nx * bedRadius; p.z = .18 + nz * bedRadius;
        const inward = v.x * nx + v.z * nz;
        if (inward < 0) { v.x -= 1.5 * inward * nx; v.z -= 1.5 * inward * nz; }
      }
      if (speed > .003) {
        if (t.ball) {
          this.direction.set(v.z, 0, -v.x).normalize(); this.rotation.setFromAxisAngle(this.direction, speed * dt / t.radius); t.model.quaternion.premultiply(this.rotation);
        } else {
          const yaw = Math.atan2(v.x, v.z);
          this.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw); t.model.quaternion.rotateTowards(this.rotation, dt * 3);
        }
      } else { v.x = 0; v.z = 0; }
    }
    if (this.toys.length === 2) {
      const [a, b] = this.toys, dx = b.position.x - a.position.x, dz = b.position.z - a.position.z;
      const length = Math.hypot(dx, dz), radius = a.radius + b.radius;
      if (!a.held && !b.held && length < radius && Math.abs(a.position.y - b.position.y) < radius) {
        const nx = length > .0001 ? dx / length : 1, nz = length > .0001 ? dz / length : 0;
        const correction = (radius - length) * .5;
        a.position.x -= nx * correction; a.position.z -= nz * correction; b.position.x += nx * correction; b.position.z += nz * correction;
        const relative = (b.velocity.x - a.velocity.x) * nx + (b.velocity.z - a.velocity.z) * nz;
        if (relative < 0) { const impulse = -.7 * relative; a.velocity.x -= nx * impulse; a.velocity.z -= nz * impulse; b.velocity.x += nx * impulse; b.velocity.z += nz * impulse; }
      }
    }
  }

  dispose() { this.disposed = true; for (const t of this.toys) t.button.remove(); }
}
