// Everything the player sees happen in the garden. The controller calls these
// after the rules engine has already decided the outcome.

import * as THREE from 'three';
import type { CropType, SoilType } from '../game/config';
import type { Cell, GrowthEntry, RabbitEvent } from '../game/engine';
import { CropModel } from './crops';
import { COLORS } from './palette';
import { Particles } from './particles';
import { Rabbit } from './rabbit';
import type { Stage } from './stage';
import { ease, tween, wait } from './tween';
import { SPACING, World, cellPosition, type HighlightTone } from './world';

const FENCE = 2 * SPACING + 0.45;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

export interface StageChange {
  cell: Cell;
  stage: number;
  needs: number;
}

export class GardenView {
  readonly world: World;
  private readonly particles: Particles;
  private readonly rabbit = new Rabbit();
  private readonly crops: (CropModel | null)[][];
  private readonly wetness: number[][];
  private readonly rainCloud = new THREE.Group();
  private readonly baseSun: { intensity: number; color: THREE.Color };

  constructor(
    private readonly stage: Stage,
    layout: readonly (readonly SoilType[])[],
  ) {
    this.world = new World(stage.scene, layout);
    this.particles = new Particles(stage.scene);
    stage.scene.add(this.rabbit.group);
    this.crops = layout.map((row) => row.map(() => null));
    this.wetness = layout.map((row) => row.map(() => 0));
    this.baseSun = { intensity: stage.sun.intensity, color: stage.sun.color.clone() };
    this.buildRainCloud();
  }

  update(time: number, dt: number): void {
    this.world.update(time);
    this.particles.update(dt);
    for (const crop of this.crops.flat()) crop?.update(time);
  }

  /** Clear every crop and dry the soil, for a new game. */
  reset(): void {
    this.crops.forEach((row, r) =>
      row.forEach((crop, c) => {
        crop?.dispose();
        this.crops[r][c] = null;
        this.setWet({ row: r, col: c }, 0);
      }),
    );
    this.particles.clear();
    this.world.setHighlight([], 'ok');
  }

  pickCell(clientX: number, clientY: number): Cell | null {
    const hit = this.stage.pick(clientX, clientY, this.world.hitTargets);
    return (hit?.object.userData.cell as Cell | undefined) ?? null;
  }

  screenPosition(cell: Cell, height = 0.6): { x: number; y: number } {
    return this.stage.toScreen(cellPosition(cell, this.world.bed(cell).top + height));
  }

  highlight(cells: Cell[], tone: HighlightTone = 'ok'): void {
    this.world.setHighlight(cells, tone);
  }

  // ---- Card effects -------------------------------------------------------

  async plant(cell: Cell, crop: CropType, needs: number): Promise<void> {
    const bed = this.world.bed(cell);
    const ground = cellPosition(cell, bed.top);
    await this.dropSeed(ground);
    this.puff(ground, bed.soil === 'rich' ? COLORS.richSoil : COLORS.plainSoil, 10);

    const model = new CropModel(crop, needs, bed.soil === 'rich' ? COLORS.richFurrow : COLORS.plainFurrow);
    model.group.position.copy(ground);
    this.stage.scene.add(model.group);
    this.crops[cell.row][cell.col] = model;
    await tween(460, (t) => model.group.scale.setScalar(Math.max(0.001, t)), ease.outBack);
  }

  async wasted(cell: Cell): Promise<void> {
    const bed = this.world.bed(cell);
    const ground = cellPosition(cell, bed.top);
    this.world.setHighlight([cell], 'warn');
    const seed = this.makeSeed();
    seed.position.copy(ground).setY(ground.y + 2.2);
    this.stage.scene.add(seed);
    await tween(380, (t) => seed.position.setY(ground.y + 2.2 * (1 - t)), ease.inQuad);
    this.puff(ground, COLORS.stoneDark, 14);
    // The seed bounces off the stone and rolls away.
    const from = seed.position.clone();
    const to = from.clone().add(new THREE.Vector3(0.75, 0, 0.55));
    await tween(
      520,
      (t) => {
        seed.position.lerpVectors(from, to, t);
        seed.position.y = from.y + Math.abs(Math.sin(t * Math.PI * 2)) * 0.45 * (1 - t);
        seed.scale.setScalar(1 - t * 0.9);
      },
      ease.linear,
    );
    this.stage.scene.remove(seed);
    await wait(250);
    this.world.setHighlight([], 'ok');
  }

  async water(row: number, changes: StageChange[]): Promise<void> {
    const cols = this.crops[row].length;
    const jobs: Promise<void>[] = [];
    for (let col = 0; col < cols; col++) {
      const cell = { row, col };
      const delay = col * 0.14;
      this.shower(cell, 26, delay, COLORS.water);
      jobs.push(wait(delay * 1000 + 350).then(() => this.wetTo(cell, 1)));
    }
    await wait(450);
    jobs.push(this.applyStages(changes));
    await Promise.all(jobs);
  }

  async rain(changes: StageChange[]): Promise<void> {
    const cloud = this.rainCloud;
    cloud.visible = true;
    await tween(600, (t) => cloud.position.set(-7 + 7 * t, 3.4, -0.4), ease.outCubic);
    for (let i = 0; i < 260; i++) {
      this.particles.emit({
        position: new THREE.Vector3(rand(-2.8, 2.8), rand(2.6, 3.2), rand(-2.8, 2.8)),
        velocity: new THREE.Vector3(0, -7, 0),
        color: 0x9ccbf0,
        size: [0.012, 0.16, 0.012],
        gravity: 2,
        drag: 0,
        spin: 0,
        life: 0.42,
        delay: rand(0, 1.3),
      });
    }
    const soak = this.allCells().map((cell) => wait(rand(200, 900)).then(() => this.wetTo(cell, 1)));
    await wait(500);
    await Promise.all([...soak, this.applyStages(changes)]);
    await wait(500);
    await tween(600, (t) => cloud.position.set(7 * t, 3.4, -0.4), ease.inQuad);
    cloud.visible = false;
  }

  async compost(change: StageChange): Promise<void> {
    const bed = this.world.bed(change.cell);
    const ground = cellPosition(change.cell, bed.top);
    const browns = [0x8a5a2b, 0xb5762e, 0x6e4a22, 0xc98f3a];
    for (let i = 0; i < 34; i++) {
      this.particles.emit({
        position: ground.clone().add(new THREE.Vector3(rand(-0.45, 0.45), rand(1.4, 2.2), rand(-0.45, 0.45))),
        velocity: new THREE.Vector3(rand(-0.4, 0.4), 0, rand(-0.4, 0.4)),
        color: browns[i % browns.length],
        size: [0.06, 0.012, 0.045],
        gravity: 2.4,
        drag: 1.5,
        spin: 6,
        life: 1.6,
        floor: ground.y + 0.03,
        delay: rand(0, 0.4),
      });
    }
    await wait(800);
    await this.applyStages([change]);
  }

  async summer(): Promise<void> {
    const { sun, hemi } = this.stage;
    const warm = new THREE.Color(0xffc979);
    const hemiBase = hemi.intensity;
    await tween(
      500,
      (t) => {
        sun.intensity = this.baseSun.intensity * (1 + 0.6 * t);
        sun.color.lerpColors(this.baseSun.color, warm, t);
        hemi.intensity = hemiBase * (1 + 0.2 * t);
      },
      ease.outCubic,
    );
    for (let i = 0; i < 70; i++) {
      this.particles.emit({
        position: new THREE.Vector3(rand(-3, 3), rand(0.2, 0.6), rand(-3, 3)),
        velocity: new THREE.Vector3(rand(-0.1, 0.1), rand(0.6, 1.1), rand(-0.1, 0.1)),
        color: COLORS.sparkle,
        size: 0.04,
        gravity: -0.2,
        drag: 0.3,
        life: 1.6,
        delay: rand(0, 0.6),
      });
    }
    await wait(900);
    await tween(
      700,
      (t) => {
        sun.intensity = this.baseSun.intensity * (1 + 0.6 * (1 - t));
        sun.color.lerpColors(warm, this.baseSun.color, t);
        hemi.intensity = hemiBase * (1 + 0.2 * (1 - t));
      },
      ease.inOutCubic,
    );
  }

  // ---- End of turn ----------------------------------------------------------

  /** Every crop grows by its soil; the soil dries out a little. */
  async grow(entries: GrowthEntry[]): Promise<void> {
    const drying = this.allCells().map((cell) => this.wetTo(cell, this.wetness[cell.row][cell.col] * 0.25, 900));
    const growing = entries.map((entry, i) =>
      wait(i * 90).then(() => this.applyStages([{ cell: entry, stage: entry.to, needs: entry.needs }])),
    );
    await Promise.all([...drying, ...growing]);
  }

  /** Lift a ripe crop out of the ground. Resolves with its screen position for the HUD. */
  async harvest(cell: Cell): Promise<{ x: number; y: number }> {
    const model = this.crops[cell.row][cell.col];
    if (!model) return this.screenPosition(cell);
    model.setTagVisible(false);
    const start = model.group.position.clone();
    const lifted = start.clone().setY(start.y + 0.9);
    await tween(
      520,
      (t) => {
        model.group.position.lerpVectors(start, lifted, t);
        model.group.rotation.y = t * Math.PI * 1.5;
      },
      ease.outBack,
    );
    for (let i = 0; i < 18; i++) {
      this.particles.emit({
        position: lifted.clone().add(new THREE.Vector3(0, 0.2, 0)),
        velocity: new THREE.Vector3(rand(-1.4, 1.4), rand(1, 2.4), rand(-1.4, 1.4)),
        color: i % 3 ? COLORS.sparkle : model.color,
        size: rand(0.03, 0.055),
        gravity: 5,
        life: 0.8,
      });
    }
    const screen = this.stage.toScreen(lifted.clone().setY(lifted.y + 0.3));
    await tween(220, (t) => model.group.scale.setScalar(Math.max(0.001, 1 - t)), ease.inQuad);
    model.dispose();
    this.crops[cell.row][cell.col] = null;
    return screen;
  }

  async rabbitRaid(event: RabbitEvent): Promise<void> {
    const rabbit = this.rabbit;
    if (event.ate) {
      const cell = event.ate;
      const bed = this.world.bed(cell);
      const plot = cellPosition(cell, bed.top);
      const outward = this.outwardDirection(cell);
      const outside = plot.clone().setY(0);
      // Line the rabbit up with the plot, just outside the fence.
      if (outward.x !== 0) outside.x = outward.x * (FENCE + 0.7);
      else outside.z = outward.z * (FENCE + 0.7);
      const far = outside.clone().add(outward.clone().multiplyScalar(1.2));

      await rabbit.appear(far);
      rabbit.faceTowards(outside);
      await rabbit.hopTo(outside, 0.4, 330);
      await rabbit.lookAround(600);
      // Land on the plot's outer edge, then turn to face the crop.
      await rabbit.hopTo(plot.clone().add(outward.clone().multiplyScalar(0.4)), 0.85, 420);
      rabbit.faceTowards(plot);

      const model = this.crops[cell.row][cell.col];
      const munching = rabbit.munch(1200);
      if (model) {
        model.setTagVisible(false);
        for (let i = 0; i < 16; i++) {
          this.particles.emit({
            position: plot.clone().add(new THREE.Vector3(rand(-0.15, 0.15), 0.3, rand(-0.15, 0.15))),
            velocity: new THREE.Vector3(rand(-0.9, 0.9), rand(0.8, 1.6), rand(-0.9, 0.9)),
            color: i % 2 ? model.color : COLORS.leaf,
            size: rand(0.025, 0.045),
            life: 0.7,
            delay: rand(0, 1),
            floor: plot.y,
          });
        }
        await tween(1100, (t) => model.plant.scale.setScalar(Math.max(0.001, 1 - t)), ease.inQuad);
        model.dispose();
        this.crops[cell.row][cell.col] = null;
      }
      await munching;
      await rabbit.hopTo(outside, 0.85, 420);
      await rabbit.hopTo(far, 0.4, 330);
      await rabbit.vanish();
    } else {
      // Nothing to eat: a lap along the outside of the left-hand fence, then off.
      const x = -(FENCE + 0.75);
      const path = [-2.2, -0.8, 0.6, 2.0].map((z) => new THREE.Vector3(x, 0, z));
      await rabbit.appear(new THREE.Vector3(x - 0.8, 0, -2.7));
      for (const p of path.slice(0, 3)) await rabbit.hopTo(p, 0.4, 320);
      await rabbit.lookAround(1000);
      await rabbit.hopTo(path[3], 0.4, 320);
      await rabbit.hopTo(new THREE.Vector3(x - 0.8, 0, 2.6), 0.4, 320);
      await rabbit.vanish();
    }
  }

  // ---- Helpers ------------------------------------------------------------------

  private async applyStages(changes: StageChange[]): Promise<void> {
    await Promise.all(
      changes.map(async ({ cell, stage, needs }) => {
        const model = this.crops[cell.row][cell.col];
        if (!model) return;
        const from = model.getProgress();
        const to = Math.min(1, stage / needs);
        model.setStage(stage);
        const ground = cellPosition(cell, this.world.bed(cell).top);
        for (let i = 0; i < 6; i++) {
          this.particles.emit({
            position: ground.clone().add(new THREE.Vector3(rand(-0.3, 0.3), rand(0.1, 0.4), rand(-0.3, 0.3))),
            velocity: new THREE.Vector3(0, rand(0.6, 1.2), 0),
            color: 0x9ee06a,
            size: 0.03,
            gravity: 0,
            drag: 1,
            life: 0.7,
            delay: rand(0, 0.2),
          });
        }
        await tween(650, (t) => model.setProgress(from + (to - from) * t), ease.outBack);
      }),
    );
  }

  private wetTo(cell: Cell, target: number, ms = 500): Promise<void> {
    const start = this.wetness[cell.row][cell.col];
    return tween(ms, (t) => this.setWet(cell, start + (target - start) * t));
  }

  private setWet(cell: Cell, amount: number): void {
    this.wetness[cell.row][cell.col] = amount;
    this.world.setWetness(cell, amount);
  }

  private shower(cell: Cell, count: number, delay: number, color: number): void {
    const bed = this.world.bed(cell);
    const ground = cellPosition(cell, bed.top);
    for (let i = 0; i < count; i++) {
      this.particles.emit({
        position: ground.clone().add(new THREE.Vector3(rand(-0.4, 0.4), rand(1.6, 2.1), rand(-0.4, 0.4))),
        velocity: new THREE.Vector3(0, -2.5, 0),
        color,
        size: [0.03, 0.06, 0.03],
        gravity: 9,
        drag: 0,
        spin: 0,
        life: 0.6,
        floor: ground.y + 0.02,
        delay: delay + rand(0, 0.35),
      });
    }
  }

  private puff(at: THREE.Vector3, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.particles.emit({
        position: at.clone().add(new THREE.Vector3(0, 0.05, 0)),
        velocity: new THREE.Vector3(Math.cos(a) * rand(0.6, 1.1), rand(0.4, 0.9), Math.sin(a) * rand(0.6, 1.1)),
        color,
        size: rand(0.03, 0.06),
        gravity: 3,
        drag: 2.5,
        life: 0.6,
      });
    }
  }

  private makeSeed(): THREE.Mesh {
    const seed = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xd9b26a, roughness: 0.6 }),
    );
    seed.scale.set(0.8, 0.6, 1.2);
    seed.castShadow = true;
    return seed;
  }

  private async dropSeed(ground: THREE.Vector3): Promise<void> {
    const seed = this.makeSeed();
    seed.position.copy(ground).setY(ground.y + 2.2);
    this.stage.scene.add(seed);
    await tween(380, (t) => {
      seed.position.setY(ground.y + 2.2 * (1 - t));
      seed.rotation.x = t * 6;
    }, ease.inQuad);
    this.stage.scene.remove(seed);
    seed.geometry.dispose();
    (seed.material as THREE.Material).dispose();
  }

  private outwardDirection(cell: Cell): THREE.Vector3 {
    const last = this.crops.length - 1;
    if (cell.row === 0) return new THREE.Vector3(0, 0, -1);
    if (cell.row === last) return new THREE.Vector3(0, 0, 1);
    if (cell.col === 0) return new THREE.Vector3(-1, 0, 0);
    return new THREE.Vector3(1, 0, 0);
  }

  private allCells(): Cell[] {
    return this.crops.flatMap((row, r) => row.map((_, c) => ({ row: r, col: c })));
  }

  private buildRainCloud(): void {
    const material = new THREE.MeshStandardMaterial({ color: 0xd9e2ea, roughness: 1, flatShading: true });
    [
      [-1.6, 0, 0, 0.9],
      [-0.5, 0.35, -0.2, 1.15],
      [0.7, 0.15, 0.1, 1.0],
      [1.7, -0.05, -0.1, 0.8],
      [0.1, -0.1, 0.6, 0.85],
    ].forEach(([x, y, z, r]) => {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), material);
      puff.position.set(x, y, z);
      puff.scale.y = 0.6;
      this.rainCloud.add(puff);
    });
    this.rainCloud.visible = false;
    this.stage.scene.add(this.rainCloud);
  }
}
