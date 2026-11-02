// Low-poly crops that grow smoothly from a sprout (progress 0) to ready to pick (progress 1).

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { CropType } from '../game/config';
import { COLORS } from './palette';

const std = (color: number, flat = true) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, flatShading: flat });

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function shadowed(object: THREE.Object3D): void {
  object.traverse((o: THREE.Object3D) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

/** A sphere with eight ribs, squashed into a pumpkin shape. */
function pumpkinGeometry(radius: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(radius, 24, 14);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const rib = 1 + 0.085 * Math.cos(Math.atan2(z, x) * 8);
    pos.setXYZ(i, x * rib, y * 0.7, z * rib);
  }
  g.computeVertexNormals();
  return g;
}

export class CropModel {
  /** Placed on the soil surface of a plot. */
  readonly group = new THREE.Group();
  /** The part that sways, pops in and gets pulled at harvest. */
  readonly plant = new THREE.Group();
  readonly color: THREE.Color;

  private progress = 0;
  private readonly apply: (p: number) => void;
  private readonly tag: CSS2DObject;
  private readonly tagText: HTMLSpanElement;
  private readonly tagBar: HTMLSpanElement;
  private readonly phase = Math.random() * Math.PI * 2;

  constructor(
    readonly crop: CropType,
    readonly needs: number,
    soilColor: number,
  ) {
    this.group.add(this.plant);

    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 5), std(soilColor));
    mound.scale.set(1, 0.28, 0.9);
    mound.receiveShadow = true;
    this.group.add(mound);

    const builders: Record<CropType, () => (p: number) => void> = {
      carrot: () => this.buildCarrot(),
      tomato: () => this.buildTomato(),
      pumpkin: () => this.buildPumpkin(),
    };
    this.apply = builders[crop]();
    this.color = new THREE.Color({ carrot: COLORS.carrot, tomato: COLORS.tomato, pumpkin: COLORS.pumpkin }[crop]);
    shadowed(this.plant);

    // A plant-marker tag at the front of the plot: "2/4" with a little progress bar.
    const el = document.createElement('div');
    el.className = 'plant-tag';
    this.tagText = document.createElement('span');
    this.tagText.className = 'plant-tag-text';
    this.tagBar = document.createElement('span');
    this.tagBar.className = 'plant-tag-bar';
    const track = document.createElement('span');
    track.className = 'plant-tag-track';
    track.appendChild(this.tagBar);
    el.append(this.tagText, track);
    this.tag = new CSS2DObject(el);
    this.tag.position.set(0.3, 0.02, 0.46);
    this.group.add(this.tag);

    this.setProgress(0);
    this.setStage(0);
  }

  getProgress(): number {
    return this.progress;
  }

  setProgress(p: number): void {
    this.progress = clamp01(p);
    this.apply(this.progress);
  }

  setStage(stage: number): void {
    const shown = Math.min(stage, this.needs);
    this.tagText.textContent = `${shown}/${this.needs}`;
    this.tagBar.style.width = `${(shown / this.needs) * 100}%`;
    this.tag.element.classList.toggle('is-ready', shown >= this.needs);
  }

  setTagVisible(visible: boolean): void {
    this.tag.visible = visible;
  }

  update(time: number): void {
    this.plant.rotation.z = Math.sin(time * 1.3 + this.phase) * 0.035;
    this.plant.rotation.x = Math.sin(time * 1.1 + this.phase * 0.7) * 0.025;
  }

  dispose(): void {
    // Removing the CSS2DObject itself fires its 'removed' event, which takes the tag out of the DOM.
    this.group.remove(this.tag);
    this.group.parent?.remove(this.group);
    this.group.traverse((o: THREE.Object3D) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: THREE.Material) => m.dispose());
      }
    });
  }

  private buildCarrot(): (p: number) => void {
    const tops = new THREE.Group();
    const leaf = std(COLORS.leaf);
    for (let i = 0; i < 5; i++) {
      const g = new THREE.ConeGeometry(0.045, 0.5, 4);
      g.translate(0, 0.25, 0);
      const blade = new THREE.Mesh(g, i % 2 ? leaf : std(COLORS.leafDark));
      blade.rotation.z = (i - 2) * 0.3;
      blade.rotation.x = (i % 2 ? 1 : -1) * 0.18;
      tops.add(blade);
    }
    const rootGeometry = new THREE.ConeGeometry(0.12, 0.55, 7);
    rootGeometry.rotateX(Math.PI); // point down
    rootGeometry.translate(0, -0.275, 0); // shoulders at y = 0
    const root = new THREE.Mesh(rootGeometry, std(COLORS.carrot));
    this.plant.add(tops, root);

    return (p) => {
      const v = 0.25 + 0.75 * p;
      tops.scale.setScalar(v);
      root.position.y = 0.01 + 0.08 * p; // the orange shoulders peek out as it ripens
      root.scale.set(0.4 + 0.6 * p, 1, 0.4 + 0.6 * p);
    };
  }

  private buildTomato(): (p: number) => void {
    const vine = new THREE.Group();
    const stemGeometry = new THREE.CylinderGeometry(0.022, 0.032, 0.82, 5);
    stemGeometry.translate(0, 0.41, 0);
    vine.add(new THREE.Mesh(stemGeometry, std(COLORS.leafDark)));

    const leaf = std(COLORS.leaf);
    [0.16, 0.3, 0.44, 0.58, 0.72].forEach((y, i) => {
      const side = i % 2 ? 1 : -1;
      const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), leaf);
      l.scale.set(1.1, 0.42, 0.8);
      l.position.set(side * 0.1, y, (i % 3) * 0.04 - 0.04);
      l.rotation.z = side * 0.35;
      vine.add(l);
    });

    const fruitMaterial = std(COLORS.tomatoUnripe, false);
    const unripe = new THREE.Color(COLORS.tomatoUnripe);
    const ripe = new THREE.Color(COLORS.tomato);
    const fruits = [
      [0.12, 0.4, 0.1],
      [-0.1, 0.52, 0.1],
      [0.04, 0.66, 0.12],
    ].map(([x, y, z]) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 9), fruitMaterial);
      f.position.set(x, y, z);
      vine.add(f);
      return f;
    });

    const stake = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.0, 0.035), std(COLORS.wood));
    stake.geometry.translate(0, 0.5, 0);
    stake.position.set(0.05, 0, -0.12);
    this.plant.add(vine, stake);

    return (p) => {
      const v = 0.2 + 0.8 * p;
      vine.scale.setScalar(v);
      stake.scale.y = 0.3 + 0.7 * p;
      const fruitSize = clamp01((p - 0.2) / 0.5);
      fruits.forEach((f, i) => f.scale.setScalar(Math.max(0.001, fruitSize * (1 - i * 0.12))));
      fruitMaterial.color.lerpColors(unripe, ripe, clamp01((p - 0.45) / 0.55));
    };
  }

  private buildPumpkin(): (p: number) => void {
    const leaves = new THREE.Group();
    const leaf = std(COLORS.leaf);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.17, 7, 5), i % 2 ? leaf : std(COLORS.leafDark));
      l.scale.set(1, 0.22, 0.75);
      l.position.set(Math.cos(a) * 0.24, 0.05, Math.sin(a) * 0.24);
      l.rotation.y = -a;
      leaves.add(l);
    }

    const radius = 0.28;
    const fruitMaterial = std(COLORS.pumpkinUnripe, false);
    const fruit = new THREE.Mesh(pumpkinGeometry(radius), fruitMaterial);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.12, 5), std(COLORS.stem));
    stem.position.y = radius * 0.7 + 0.04;
    stem.rotation.z = 0.25;
    fruit.add(stem);
    const unripe = new THREE.Color(COLORS.pumpkinUnripe);
    const ripe = new THREE.Color(COLORS.pumpkin);
    this.plant.add(leaves, fruit);

    return (p) => {
      leaves.scale.setScalar(0.35 + 0.65 * Math.min(1, p * 1.6));
      const s = 0.18 + 0.82 * p;
      fruit.scale.setScalar(s);
      fruit.position.set(0.02, radius * 0.7 * s, 0.03);
      fruitMaterial.color.lerpColors(unripe, ripe, clamp01((p - 0.2) / 0.7));
    };
  }
}
