// One instanced mesh for every small flying bit: water drops, rain, compost, dust, sparkles.

import * as THREE from 'three';

export interface ParticleOptions {
  position: THREE.Vector3;
  velocity?: THREE.Vector3;
  color: THREE.ColorRepresentation;
  /** Size along x, y, z. A single number makes a round bit. */
  size?: number | [number, number, number];
  life?: number;
  gravity?: number;
  drag?: number;
  spin?: number;
  /** Particles stop when they reach this height. */
  floor?: number;
  delay?: number;
}

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  size: THREE.Vector3;
  age: number;
  life: number;
  gravity: number;
  drag: number;
  spin: number;
  rot: number;
  floor: number | null;
}

export class Particles {
  private readonly mesh: THREE.InstancedMesh;
  private readonly items: Particle[] = [];
  private readonly dummy = new THREE.Object3D();

  constructor(
    scene: THREE.Scene,
    private readonly capacity = 1200,
  ) {
    const material = new THREE.MeshStandardMaterial({ roughness: 0.55, flatShading: true });
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const white = new THREE.Color(0xffffff);
    for (let i = 0; i < capacity; i++) this.mesh.setColorAt(i, white);
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  emit(options: ParticleOptions): void {
    if (this.items.length >= this.capacity) this.items.shift();
    const size = options.size ?? 0.05;
    const delay = options.delay ?? 0;
    this.items.push({
      pos: options.position.clone(),
      vel: options.velocity?.clone() ?? new THREE.Vector3(),
      color: new THREE.Color(options.color),
      size: typeof size === 'number' ? new THREE.Vector3(size, size, size) : new THREE.Vector3(...size),
      age: -delay,
      life: options.life ?? 1,
      gravity: options.gravity ?? 6,
      drag: options.drag ?? 0.6,
      spin: options.spin ?? 4,
      // Non-spinning bits (rain streaks) keep their shape upright.
      rot: options.spin === 0 ? 0 : Math.random() * Math.PI * 2,
      floor: options.floor ?? null,
    });
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age += dt;
      if (p.age < 0) continue;
      if (p.age >= p.life) {
        this.items.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.pos.addScaledVector(p.vel, dt);
      if (p.floor !== null && p.pos.y < p.floor) {
        p.pos.y = p.floor;
        p.vel.set(0, 0, 0);
      }
    }

    let n = 0;
    for (const p of this.items) {
      if (p.age < 0) continue;
      const t = p.age / p.life;
      const fade = t > 0.7 ? 1 - (t - 0.7) / 0.3 : Math.min(1, t * 12);
      this.dummy.position.copy(p.pos);
      this.dummy.rotation.set(p.rot + p.age * p.spin, p.age * p.spin * 0.6, 0);
      this.dummy.scale.copy(p.size).multiplyScalar(Math.max(0.001, fade));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(n, this.dummy.matrix);
      this.mesh.setColorAt(n, p.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear(): void {
    this.items.length = 0;
  }
}
