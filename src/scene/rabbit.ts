// A low-poly wild rabbit that hops in arcs, munches and looks around.

import * as THREE from 'three';
import { COLORS } from './palette';
import { ease, tween } from './tween';

const std = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });

export class Rabbit {
  /** Stands on the ground at y = 0 and faces +Z before rotation. */
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly ears: THREE.Group[] = [];

  constructor() {
    const fur = std(COLORS.rabbit);
    const light = std(COLORS.rabbitLight);
    const pink = std(COLORS.rabbitInner);
    const dark = std(COLORS.eye);

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), fur);
    torso.scale.set(1, 0.85, 1.22);
    torso.position.set(0, 0.25, -0.04);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), light);
    chest.position.set(0, 0.24, 0.18);
    const tail = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), light);
    tail.position.set(0, 0.3, -0.38);
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), fur);
      foot.scale.set(0.65, 0.4, 1.5);
      foot.position.set(side * 0.15, 0.04, -0.06);
      this.body.add(foot);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), light);
      paw.position.set(side * 0.08, 0.04, 0.24);
      this.body.add(paw);
    }
    this.body.add(torso, chest, tail);

    this.head.position.set(0, 0.42, 0.27);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), fur);
    skull.scale.set(1, 0.95, 1.1);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), light);
    muzzle.position.set(0, -0.05, 0.14);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), pink);
    nose.position.set(0, -0.02, 0.21);
    this.head.add(skull, muzzle, nose);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 5), dark);
      eye.position.set(side * 0.1, 0.03, 0.11);
      this.head.add(eye);

      const ear = new THREE.Group();
      ear.position.set(side * 0.07, 0.12, -0.02);
      ear.rotation.set(-0.2, 0, side * -0.18);
      const outer = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.26, 3, 6), fur);
      outer.position.y = 0.17;
      outer.scale.z = 0.6;
      const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.2, 3, 6), pink);
      inner.position.set(0, 0.17, 0.022);
      inner.scale.z = 0.4;
      ear.add(outer, inner);
      this.head.add(ear);
      this.ears.push(ear);
    }
    this.body.add(this.head);
    this.group.add(this.body);
    this.group.scale.setScalar(0.85);
    this.group.visible = false;
    this.group.traverse((o: THREE.Object3D) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
  }

  faceTowards(point: THREE.Vector3): void {
    this.group.rotation.y = Math.atan2(point.x - this.group.position.x, point.z - this.group.position.z);
  }

  async appear(at: THREE.Vector3): Promise<void> {
    this.group.position.copy(at);
    this.group.visible = true;
    await tween(260, (t) => this.group.scale.setScalar(0.85 * t), ease.outBack);
  }

  async vanish(): Promise<void> {
    await tween(240, (t) => this.group.scale.setScalar(0.85 * (1 - t)), ease.inQuad);
    this.group.visible = false;
  }

  async hopTo(point: THREE.Vector3, height = 0.45, ms = 340): Promise<void> {
    this.faceTowards(point);
    const from = this.group.position.clone();
    await tween(
      ms,
      (t) => {
        this.group.position.lerpVectors(from, point, t);
        this.group.position.y = from.y + (point.y - from.y) * t + height * 4 * t * (1 - t);
        const s = Math.sin(t * Math.PI);
        this.body.scale.set(1 - 0.08 * s, 1 + 0.16 * s, 1 - 0.08 * s);
        this.ears.forEach((ear) => (ear.rotation.x = -0.2 - 0.45 * s));
      },
      ease.linear,
    );
    await tween(110, (t) => {
      const squash = 1 - t;
      this.body.scale.set(1 + 0.1 * squash, 1 - 0.16 * squash, 1 + 0.1 * squash);
    });
  }

  async munch(ms = 1100): Promise<void> {
    await tween(
      ms,
      (t) => {
        const chew = Math.sin(t * Math.PI * 10);
        this.head.rotation.x = 0.35 * Math.sin(t * Math.PI) + chew * 0.08;
        this.ears.forEach((ear, i) => (ear.rotation.z = (i ? 1 : -1) * (0.18 + chew * 0.06)));
      },
      ease.linear,
    );
    this.head.rotation.x = 0;
  }

  async lookAround(ms = 900): Promise<void> {
    await tween(
      ms,
      (t) => {
        this.head.rotation.y = Math.sin(t * Math.PI * 2) * 0.6;
        this.ears.forEach((ear) => (ear.rotation.x = -0.2 + Math.sin(t * Math.PI * 4) * 0.12));
      },
      ease.inOutCubic,
    );
    this.head.rotation.y = 0;
  }
}
