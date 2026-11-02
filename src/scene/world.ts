// The diorama: a floating grass island, 16 garden plots, a fence and fair decorations.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { SoilType } from '../game/config';
import type { Cell } from '../game/engine';
import { COLORS } from './palette';

/** Distance between plot centres, and the size of one plot. */
export const SPACING = 1.25;
export const PLOT = 1.06;
const FENCE = 2 * SPACING + 0.45;
const ISLAND = 10;

export function cellPosition(cell: Cell, y = 0): THREE.Vector3 {
  return new THREE.Vector3((cell.col - 1.5) * SPACING, y, (cell.row - 1.5) * SPACING);
}

export interface Bed {
  cell: Cell;
  soil: SoilType;
  /** Height of the soil surface; crops stand here. */
  top: number;
  soilMaterial: THREE.MeshStandardMaterial | null;
  baseColor: THREE.Color;
  hit: THREE.Mesh;
  highlight: THREE.Group;
  highlightMaterials: THREE.MeshBasicMaterial[];
  sparkles: THREE.Mesh[];
}

export type HighlightTone = 'ok' | 'warn';

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true, ...extra });

/** Small seeded random generator, so decorations land in the same place every load. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundedRect(size: number, radius: number): THREE.Shape {
  const h = size / 2;
  const s = new THREE.Shape();
  s.moveTo(-h + radius, -h);
  s.lineTo(h - radius, -h);
  s.quadraticCurveTo(h, -h, h, -h + radius);
  s.lineTo(h, h - radius);
  s.quadraticCurveTo(h, h, h - radius, h);
  s.lineTo(-h + radius, h);
  s.quadraticCurveTo(-h, h, -h, h - radius);
  s.lineTo(-h, -h + radius);
  s.quadraticCurveTo(-h, -h, -h + radius, -h);
  return s;
}

function slab(size: number, radius: number, depth: number, top: number, color: number, bevel = 0): THREE.Mesh {
  const geometry = new THREE.ExtrudeGeometry(roundedRect(size, radius), {
    depth,
    curveSegments: 8,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geometry.rotateX(-Math.PI / 2); // extrude upwards along +Y
  geometry.translate(0, top - depth - bevel, 0);
  const mesh = new THREE.Mesh(geometry, std(color));
  mesh.receiveShadow = true;
  return mesh;
}

function box(w: number, h: number, d: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class World {
  readonly root = new THREE.Group();
  readonly beds: Bed[][] = [];
  readonly hitTargets: THREE.Mesh[] = [];
  private readonly sunflowerHeads: THREE.Object3D[] = [];
  private readonly clouds: THREE.Group[] = [];
  private readonly flags: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, layout: readonly (readonly SoilType[])[]) {
    scene.add(this.root);
    this.buildIsland();
    layout.forEach((rowSoils, row) => {
      this.beds.push(rowSoils.map((soil, col) => this.buildBed({ row, col }, soil)));
    });
    this.buildFence();
    this.buildLabels(layout.length, layout[0].length);
    this.buildDecorations();
    this.buildClouds();
  }

  bed(cell: Cell): Bed {
    return this.beds[cell.row][cell.col];
  }

  /** Show a coloured frame on these plots (and hide it everywhere else). */
  setHighlight(cells: Cell[], tone: HighlightTone): void {
    const color = tone === 'ok' ? COLORS.ok : COLORS.warn;
    const keys = new Set(cells.map((c) => `${c.row},${c.col}`));
    for (const bed of this.beds.flat()) {
      const on = keys.has(`${bed.cell.row},${bed.cell.col}`);
      bed.highlight.visible = on;
      if (on) bed.highlightMaterials.forEach((m) => m.color.setHex(color));
    }
  }

  /** Darken soil to look wet: 0 is dry, 1 is soaked. */
  setWetness(cell: Cell, amount: number): void {
    const bed = this.bed(cell);
    if (!bed.soilMaterial) return;
    bed.soilMaterial.color.copy(bed.baseColor).multiplyScalar(1 - 0.38 * amount);
  }

  update(time: number): void {
    for (const bed of this.beds.flat()) {
      if (bed.highlight.visible) {
        const pulse = 0.6 + 0.35 * Math.sin(time * 6);
        bed.highlightMaterials[0].opacity = pulse;
      }
      bed.sparkles.forEach((s, i) => {
        const twinkle = 0.5 + 0.5 * Math.sin(time * 2.4 + i * 1.7 + bed.cell.col * 2.1 + bed.cell.row);
        s.scale.setScalar(0.35 + twinkle * 0.9);
        s.rotation.y = time * 0.8 + i;
      });
    }
    this.sunflowerHeads.forEach((head, i) => {
      head.rotation.z = Math.sin(time * 0.9 + i * 1.3) * 0.06;
    });
    this.flags.forEach((flag, i) => {
      flag.rotation.x = Math.sin(time * 2.2 + i * 0.7) * 0.18;
    });
    this.clouds.forEach((cloud, i) => {
      cloud.position.x += 0.0035 * (1 + i * 0.25);
      if (cloud.position.x > 16) cloud.position.x = -16;
    });
  }

  private buildIsland(): void {
    this.root.add(slab(ISLAND, 1.3, 0.3, 0, COLORS.grass, 0.06));
    this.root.add(slab(ISLAND - 0.2, 1.22, 1.2, -0.36, COLORS.dirt));
    this.root.add(slab(ISLAND - 0.7, 1.05, 0.5, -1.56, COLORS.bedrock));

    // A worn patch of grass under the garden beds.
    const patch = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(FENCE * 2 - 0.2, 0.5)), std(COLORS.grassDark));
    patch.rotation.x = -Math.PI / 2;
    patch.position.y = 0.005;
    patch.receiveShadow = true;
    this.root.add(patch);
  }

  private buildBed(cell: Cell, soil: SoilType): Bed {
    const group = new THREE.Group();
    group.position.copy(cellPosition(cell));
    this.root.add(group);
    const rand = seeded(cell.row * 17 + cell.col * 5 + 3);

    let top: number;
    let soilMaterial: THREE.MeshStandardMaterial | null = null;
    const sparkles: THREE.Mesh[] = [];

    if (soil === 'stone') {
      top = 0.18;
      const slabMesh = box(PLOT - 0.02, top, PLOT - 0.02, std(COLORS.stone));
      slabMesh.position.y = top / 2;
      group.add(slabMesh);
      const pebble = std(COLORS.stoneDark);
      for (let i = 0; i < 5; i++) {
        const r = 0.07 + rand() * 0.09;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), pebble);
        rock.position.set((rand() - 0.5) * 0.7, top + r * 0.4, (rand() - 0.5) * 0.7);
        rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
        rock.scale.y = 0.6;
        rock.castShadow = true;
        group.add(rock);
      }
    } else {
      const frameHeight = 0.24;
      const frame = box(PLOT, frameHeight, PLOT, std(COLORS.wood));
      frame.position.y = frameHeight / 2;
      group.add(frame);

      const rich = soil === 'rich';
      soilMaterial = std(rich ? COLORS.richSoil : COLORS.plainSoil);
      const earth = box(PLOT - 0.16, 0.08, PLOT - 0.16, soilMaterial);
      earth.position.y = frameHeight + 0.03;
      group.add(earth);
      top = frameHeight + 0.07;

      const furrowMaterial = std(rich ? COLORS.richFurrow : COLORS.plainFurrow);
      for (const z of [-0.26, 0, 0.26]) {
        const furrow = box(PLOT - 0.28, 0.05, 0.12, furrowMaterial);
        furrow.position.set(0, top + 0.02, z);
        group.add(furrow);
      }

      if (rich) {
        const glint = new THREE.MeshStandardMaterial({
          color: COLORS.sparkle,
          emissive: COLORS.sparkle,
          emissiveIntensity: 0.9,
          flatShading: true,
        });
        for (let i = 0; i < 5; i++) {
          const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), glint);
          s.position.set((rand() - 0.5) * 0.72, top + 0.09 + rand() * 0.06, (rand() - 0.5) * 0.72);
          group.add(s);
          sparkles.push(s);
        }
      }
    }

    // Invisible box used for pointer picking (taller than the plot, so crops count too).
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(SPACING * 0.98, 1.6, SPACING * 0.98),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.y = 0.8;
    hit.userData.cell = cell;
    group.add(hit);
    this.hitTargets.push(hit);

    // Selection frame plus a faint fill.
    const highlight = new THREE.Group();
    const outer = (PLOT + 0.16) / 2;
    const inner = (PLOT - 0.02) / 2;
    const ring = roundedRect(outer * 2, 0.12);
    ring.holes.push(roundedRect(inner * 2, 0.06));
    const ringMaterial = new THREE.MeshBasicMaterial({ color: COLORS.ok, transparent: true, opacity: 0.9, depthWrite: false });
    const fillMaterial = new THREE.MeshBasicMaterial({ color: COLORS.ok, transparent: true, opacity: 0.22, depthWrite: false });
    const ringMesh = new THREE.Mesh(new THREE.ShapeGeometry(ring), ringMaterial);
    const fillMesh = new THREE.Mesh(new THREE.PlaneGeometry(PLOT - 0.04, PLOT - 0.04), fillMaterial);
    for (const m of [ringMesh, fillMesh]) {
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 2;
      highlight.add(m);
    }
    highlight.position.y = top + 0.07;
    highlight.visible = false;
    group.add(highlight);

    return {
      cell,
      soil,
      top,
      soilMaterial,
      baseColor: soilMaterial ? soilMaterial.color.clone() : new THREE.Color(COLORS.stone),
      hit,
      highlight,
      highlightMaterials: [ringMaterial, fillMaterial],
      sparkles,
    };
  }

  private buildFence(): void {
    const wood = std(COLORS.wood);
    const step = (FENCE * 2) / 10;
    const posts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = -FENCE + i * step;
      posts.push(new THREE.Vector3(t, 0, -FENCE), new THREE.Vector3(-FENCE, 0, t), new THREE.Vector3(FENCE, 0, t));
      if (i !== 5) posts.push(new THREE.Vector3(t, 0, FENCE)); // gap for the gate
    }
    const unique = posts.filter((p, i) => posts.findIndex((q) => q.distanceTo(p) < 0.01) === i);
    const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.62, 0.11), wood, unique.length);
    const m = new THREE.Matrix4();
    unique.forEach((p, i) => postMesh.setMatrixAt(i, m.makeTranslation(p.x, 0.31, p.z)));
    postMesh.castShadow = true;
    postMesh.receiveShadow = true;
    this.root.add(postMesh);

    const rail = (x1: number, z1: number, x2: number, z2: number, y: number) => {
      const length = Math.hypot(x2 - x1, z2 - z1);
      const r = box(length, 0.06, 0.05, wood);
      r.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      r.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      this.root.add(r);
    };
    for (const y of [0.24, 0.48]) {
      rail(-FENCE, -FENCE, FENCE, -FENCE, y);
      rail(-FENCE, -FENCE, -FENCE, FENCE, y);
      rail(FENCE, -FENCE, FENCE, FENCE, y);
      rail(-FENCE, FENCE, -step, FENCE, y);
      rail(step, FENCE, FENCE, FENCE, y);
    }

    // Stepping stones from the gate to the island's edge.
    const stoneMat = std(COLORS.stone);
    [3.45, 3.95, 4.45].forEach((z, i) => {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.26 - i * 0.02, 0.28, 0.05, 7), stoneMat);
      s.position.set((i % 2) * 0.12 - 0.05, 0.02, z);
      s.receiveShadow = true;
      this.root.add(s);
    });
  }

  private buildLabels(rows: number, cols: number): void {
    const label = (text: string, kind: 'row' | 'col', position: THREE.Vector3) => {
      const el = document.createElement('div');
      el.className = `grid-label grid-label-${kind}`;
      el.textContent = text;
      el.setAttribute('aria-hidden', 'true');
      const obj = new CSS2DObject(el);
      obj.position.copy(position);
      this.root.add(obj);
    };
    for (let c = 0; c < cols; c++) label(String(c + 1), 'col', cellPosition({ row: 0, col: c }).setZ(-FENCE - 0.5));
    for (let r = 0; r < rows; r++) label(String(r + 1), 'row', cellPosition({ row: r, col: 0 }).setX(-FENCE - 0.5));
  }

  private buildDecorations(): void {
    this.buildTent(new THREE.Vector3(-3.85, 0, -3.85));
    [
      [3.55, -4.05, 1.75],
      [4.15, -3.35, 1.45],
      [3.85, -2.55, 1.9],
      [4.3, -1.75, 1.3],
    ].forEach(([x, z, h], i) => this.buildSunflower(new THREE.Vector3(x, 0, z), h, i));
    this.buildHay(new THREE.Vector3(3.75, 0, 3.65), 0.4);
    this.buildHay(new THREE.Vector3(4.15, 0, 2.85), -0.3);
    this.buildHay(new THREE.Vector3(3.95, 0.5, 3.25), 0.1);
    this.buildTree(new THREE.Vector3(-3.9, 0, 3.7));
    this.buildBunting();
    this.buildGrass();
  }

  private buildTent(at: THREE.Vector3): void {
    const segments = 10;
    const striped = (geometry: THREE.BufferGeometry) => {
      const g = geometry.toNonIndexed();
      const pos = g.getAttribute('position');
      const colors: number[] = [];
      const red = new THREE.Color(COLORS.tentRed);
      const white = new THREE.Color(COLORS.tentWhite);
      for (let i = 0; i < pos.count; i += 3) {
        // Colour each triangle by the angle of its centre.
        const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
        const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
        const band = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * segments) % 2;
        const c = band ? red : white;
        for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      g.computeVertexNormals();
      return g;
    };
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    const walls = new THREE.Mesh(striped(new THREE.CylinderGeometry(0.82, 0.86, 0.62, segments, 1, true)), material);
    walls.position.copy(at).setY(0.31);
    const roof = new THREE.Mesh(striped(new THREE.ConeGeometry(1.0, 0.95, segments)), material);
    roof.position.copy(at).setY(0.62 + 0.47);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 5), std(COLORS.woodDark));
    pole.position.copy(at).setY(1.75);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), std(COLORS.sparkle, { side: THREE.DoubleSide }));
    flag.geometry.translate(0.15, 0, 0);
    flag.position.copy(at).setY(1.9);
    this.flags.push(flag);
    for (const m of [walls, roof, pole, flag]) {
      m.castShadow = true;
      m.receiveShadow = true;
      this.root.add(m);
    }
  }

  private buildSunflower(at: THREE.Vector3, height: number, index: number): void {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, height, 5), std(COLORS.leafDark));
    stem.position.copy(at).setY(height / 2);
    stem.castShadow = true;
    this.root.add(stem);
    for (const side of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), std(COLORS.leaf));
      leaf.scale.set(1.3, 0.25, 0.6);
      leaf.position.copy(at).add(new THREE.Vector3(side * 0.15, height * (0.35 + index * 0.04), 0));
      leaf.rotation.z = side * 0.4;
      leaf.castShadow = true;
      this.root.add(leaf);
    }
    const head = new THREE.Group();
    head.position.copy(at).setY(height);
    const face = new THREE.Group();
    face.rotation.set(-0.35, 0.45, 0); // turn toward the camera and the sun
    const centre = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.07, 10), std(COLORS.sunflowerCentre));
    centre.rotation.x = Math.PI / 2;
    face.add(centre);
    const petalMat = std(COLORS.sunflower);
    for (let i = 0; i < 12; i++) {
      const petal = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.025), petalMat);
      const a = (i / 12) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.24, Math.sin(a) * 0.24, -0.01);
      petal.rotation.z = a - Math.PI / 2;
      face.add(petal);
    }
    face.traverse((o: THREE.Object3D) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    head.add(face);
    this.root.add(head);
    this.sunflowerHeads.push(head);
  }

  private buildHay(at: THREE.Vector3, turn: number): void {
    const bale = box(0.82, 0.48, 0.52, std(COLORS.hay));
    bale.position.copy(at).setY(at.y + 0.24);
    bale.rotation.y = turn;
    this.root.add(bale);
    const tieMat = std(COLORS.hayDark);
    for (const x of [-0.22, 0.22]) {
      const tie = box(0.05, 0.5, 0.54, tieMat);
      tie.position.set(x, 0, 0);
      bale.add(tie);
    }
  }

  private buildTree(at: THREE.Vector3): void {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.9, 6), std(COLORS.woodDark));
    trunk.position.copy(at).setY(0.45);
    trunk.castShadow = true;
    this.root.add(trunk);
    const leaves = std(COLORS.leaf);
    [
      [0, 1.15, 0, 0.55],
      [0.32, 0.95, 0.1, 0.38],
      [-0.28, 1.0, -0.12, 0.4],
      [0.05, 1.5, 0.05, 0.36],
    ].forEach(([x, y, z, r]) => {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaves);
      blob.position.copy(at).add(new THREE.Vector3(x, y, z));
      blob.castShadow = true;
      blob.receiveShadow = true;
      this.root.add(blob);
    });
  }

  private buildBunting(): void {
    const start = new THREE.Vector3(-3.85, 1.55, -3.85);
    const end = new THREE.Vector3(3.15, 1.45, -4.1);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.55, 5), std(COLORS.woodDark));
    pole.position.set(end.x, 0.78, end.z);
    pole.castShadow = true;
    this.root.add(pole);

    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const p = start.clone().lerp(end, t);
      p.y -= Math.sin(t * Math.PI) * 0.35; // sag
      points.push(p);
    }
    const string = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x6d5a45 }));
    this.root.add(string);

    const colors = [COLORS.tentRed, COLORS.sparkle, 0x3a6fc4, COLORS.tentWhite];
    const triangle = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.11, 0, 0),
      new THREE.Vector3(0.11, 0, 0),
      new THREE.Vector3(0, -0.24, 0),
    ]);
    triangle.computeVertexNormals();
    for (let i = 2; i < points.length - 1; i += 2) {
      const flag = new THREE.Mesh(triangle, std(colors[(i / 2) % colors.length], { side: THREE.DoubleSide }));
      flag.position.copy(points[i]);
      flag.rotation.y = -0.03;
      flag.castShadow = true;
      this.root.add(flag);
      this.flags.push(flag);
    }
  }

  private buildGrass(): void {
    const rand = seeded(42);
    const spots: THREE.Vector3[] = [];
    while (spots.length < 150) {
      const x = (rand() - 0.5) * (ISLAND - 1.2);
      const z = (rand() - 0.5) * (ISLAND - 1.2);
      const insideFence = Math.abs(x) < FENCE + 0.25 && Math.abs(z) < FENCE + 0.25;
      const onPath = Math.abs(x) < 0.5 && z > FENCE;
      const nearTent = Math.hypot(x + 3.85, z + 3.85) < 1.15;
      const inCorner = Math.abs(x) > 3.5 && Math.abs(z) > 3.5 && Math.hypot(Math.abs(x) - 3.7, Math.abs(z) - 3.7) > 1.1;
      if (!insideFence && !onPath && !nearTent && !inCorner) spots.push(new THREE.Vector3(x, 0, z));
    }
    const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.24, 4), std(COLORS.grassDark), spots.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    spots.forEach((p, i) => {
      const s = 0.7 + rand() * 0.7;
      q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.4, rand() * 3, (rand() - 0.5) * 0.4));
      m.compose(new THREE.Vector3(p.x, 0.1 * s, p.z), q, new THREE.Vector3(s, s, s));
      tufts.setMatrixAt(i, m);
    });
    tufts.castShadow = true;
    this.root.add(tufts);

    // A scatter of wildflowers.
    const flowerColors = [0xffffff, 0xf7d64a, 0xf3a0b8, 0xb9a3f0];
    const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.055, 0), std(0xffffff), 40);
    for (let i = 0; i < 40; i++) {
      const p = spots[Math.floor(rand() * spots.length)];
      m.makeTranslation(p.x + (rand() - 0.5) * 0.3, 0.2, p.z + (rand() - 0.5) * 0.3);
      flowers.setMatrixAt(i, m);
      flowers.setColorAt(i, new THREE.Color(flowerColors[i % flowerColors.length]));
    }
    this.root.add(flowers);
  }

  private buildClouds(): void {
    const material = new THREE.MeshStandardMaterial({ color: COLORS.cloud, roughness: 1, flatShading: true });
    const rand = seeded(7);
    [
      [-13, 1.6, -3],
      [-4, 1.2, -9],
      [7, 1.8, -8],
      [13, 1.0, -1],
      [0, 2.2, -12],
    ].forEach(([x, y, z]) => {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(rand() * 3);
      for (let i = 0; i < puffs; i++) {
        const r = 0.6 + rand() * 0.6;
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), material);
        puff.position.set(i * 0.8 - puffs * 0.4, rand() * 0.3, (rand() - 0.5) * 0.6);
        puff.scale.y = 0.7;
        cloud.add(puff);
      }
      cloud.position.set(x, y, z);
      this.root.add(cloud);
      this.clouds.push(cloud);
    });
  }
}
