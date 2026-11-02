// Renderer, orthographic "2.5D" camera, lights and picking.

import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

/** Region of the garden that must stay in view, in world units (width × depth on screen). */
const FIT_WIDTH = 11.5;
const FIT_HEIGHT = 8.6;
const FIT_WIDTH_NARROW = 9.2;

export class Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  readonly renderer: THREE.WebGLRenderer;
  readonly labels = new CSS2DRenderer();
  readonly sun = new THREE.DirectionalLight(0xfff0d6, 2.6);
  readonly hemi = new THREE.HemisphereLight(0xd8efff, 0x7a6243, 1.7);

  private readonly target = new THREE.Vector3(0, 0, 0.35);
  private readonly raycaster = new THREE.Raycaster();
  private insets = { top: 0, bottom: 0 };
  private worldPerPixel = 0.02;

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'scene-canvas';
    host.appendChild(this.renderer.domElement);

    this.labels.domElement.className = 'scene-labels';
    host.appendChild(this.labels.domElement);

    // A fixed three-quarter view: rows run back-to-front, columns left-to-right.
    const azimuth = THREE.MathUtils.degToRad(30);
    const elevation = THREE.MathUtils.degToRad(41);
    const distance = 40;
    this.camera.position
      .set(
        Math.sin(azimuth) * Math.cos(elevation),
        Math.sin(elevation),
        Math.cos(azimuth) * Math.cos(elevation),
      )
      .multiplyScalar(distance)
      .add(this.target);
    this.camera.lookAt(this.target);

    this.scene.add(this.hemi);
    this.sun.position.set(-6, 13, 5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const shadowCam = this.sun.shadow.camera;
    shadowCam.left = -8;
    shadowCam.right = 8;
    shadowCam.top = 8;
    shadowCam.bottom = -8;
    shadowCam.near = 1;
    shadowCam.far = 40;
    shadowCam.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);

    const fill = new THREE.DirectionalLight(0xbfd8ff, 0.5);
    fill.position.set(8, 5, 6);
    this.scene.add(fill);

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  /** Pixels covered by the HUD at the top and bottom, so the garden centres in the free space. */
  setInsets(top: number, bottom: number): void {
    this.insets = { top, bottom };
    this.resize();
  }

  resize(): void {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    const free = Math.max(160, height - this.insets.top - this.insets.bottom);

    // On phones, let the island's far corners crop so the plots stay a usable size.
    const fitWidth = width < 640 ? FIT_WIDTH_NARROW : FIT_WIDTH;
    const k = Math.max(FIT_HEIGHT / free, fitWidth / width);
    this.worldPerPixel = k;
    const halfW = (k * width) / 2;
    const halfH = (k * height) / 2;
    const shift = (k * (this.insets.top - this.insets.bottom)) / 2;

    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH + shift;
    this.camera.bottom = -halfH + shift;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.labels.setSize(width, height);
  }

  /** Approximate on-screen pixels per world unit (useful for sizing labels). */
  get pixelsPerUnit(): number {
    return 1 / this.worldPerPixel;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  /** First object hit under a client-space point, from a list of candidates. */
  pick(clientX: number, clientY: number, objects: THREE.Object3D[]): THREE.Intersection | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObjects(objects, false)[0] ?? null;
  }

  /** Client-space pixel position of a world point. */
  toScreen(point: THREE.Vector3): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const p = point.clone().project(this.camera);
    return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
  }
}
