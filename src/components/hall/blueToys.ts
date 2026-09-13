import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface CatToy {
  position: THREE.Vector3;
  bat: (direction: THREE.Vector3) => void;
}
type Toy = CatToy & { node: THREE.Group; model: THREE.Object3D; velocity: THREE.Vector3; radius: number; button: HTMLButtonElement; lastInput: number; ball: boolean; left: string; top: string };
export const BLUE_TOY_BUILD = 'v1';

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

  constructor(private container: HTMLElement, private play: (toy: CatToy) => void) {}

  add(gltf: GLTF, ball: boolean) {
    if (this.disposed) return;
    const model = gltf.scene, node = new THREE.Group();
    node.add(model); this.root.add(node);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'hall__blue-toy'; button.hidden = true;
    const radius = ball ? .055 : .06;
    const toy: Toy = { node, model, position: node.position, velocity: new THREE.Vector3(), radius, button, ball, left: '', top: '', lastInput: -10, bat: direction => this.impulse(toy, direction, .48) };
    node.position.set(ball ? -2.16 : -1.02, radius, ball ? .43 : .47);
    if (this.container.clientWidth < 600) node.position.set(ball ? -1.18 : -.78, radius, ball ? .59 : .45);
    button.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.stopPropagation(); e.preventDefault(); button.focus({ preventScroll: true });
      this.nudge(toy, e.clientX - button.getBoundingClientRect().left - button.clientWidth / 2);
    });
    button.addEventListener('click', e => { e.stopPropagation(); if (e.detail === 0) this.nudge(toy, 0); });
    this.container.append(button); this.toys.push(toy);
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
    if (horizontal > .85) { toy.velocity.x *= .85 / horizontal; toy.velocity.z *= .85 / horizontal; }
  }

  update(dt: number, camera: THREE.Camera, visible: boolean, reduce: boolean, compact: boolean) {
    this.compact = compact;
    this.clock += dt; this.enabled = visible; this.reduce = reduce;
    // Hidden/paused scenes never build up simulation time.
    this.root.visible = visible;
    if (!visible) { this.accumulator = 0; for (const t of this.toys) t.button.hidden = true; return; }
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
      const p = t.position, v = t.velocity;
      const speed = Math.hypot(v.x, v.z);
      v.y -= 3.5 * dt; p.addScaledVector(v, dt);
      if (p.y < t.radius) { p.y = t.radius; v.y = Math.abs(v.y) > .12 ? -v.y * .3 : 0; }
      const damping = Math.exp(-(t.ball ? 1.35 : 2.6) * dt);
      v.x *= damping; v.z *= damping;
      // A modest play area in front of the bed, outside its bolster and cabinet lane.
      const minX = (this.compact ? -1.4 : -2.3) + t.radius, maxX = -.65 - t.radius, minZ = .30 + t.radius, maxZ = .67 - t.radius;
      if (p.x < minX || p.x > maxX) { p.x = THREE.MathUtils.clamp(p.x, minX, maxX); v.x *= -.5; }
      if (p.z < minZ || p.z > maxZ) { p.z = THREE.MathUtils.clamp(p.z, minZ, maxZ); v.z *= -.5; }
      // The padded bed is a solid obstacle, not a reset/teleport zone.
      const bx = p.x + 1.65, bz = p.z - .18, distance = Math.hypot(bx, bz), bedRadius = .37 + t.radius;
      if (distance < bedRadius) {
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
      if (length < radius && Math.abs(a.position.y - b.position.y) < radius) {
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
