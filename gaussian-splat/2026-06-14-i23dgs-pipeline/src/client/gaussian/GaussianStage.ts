import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PRODUCT_TARGET } from '../animation/camera-paths';

export interface GaussianStageOptions {
  canvas: HTMLCanvasElement;
  onStatus: (message: string) => void;
}

export interface CameraPreset {
  position: [number, number, number];
  lookAt: [number, number, number];
  up?: [number, number, number];
  fov?: number;
  maxDistance?: number;
}

export interface CameraSnapshot {
  position: [number, number, number];
  lookAt: [number, number, number];
  up: [number, number, number];
  fov: number;
  distance: number;
  maxDistance: number;
}

export class GaussianStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private readonly viewer: GaussianSplats3D.Viewer;
  private readonly clock = new THREE.Clock();
  private fallbackGroup?: THREE.Group;
  private platform?: THREE.Mesh;
  private frameId = 0;
  private splatSceneCount = 0;

  constructor(private readonly options: GaussianStageOptions) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: options.canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf6f7fb);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.02, 500);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.copy(PRODUCT_TARGET);
    this.controls.minDistance = 0.15;
    this.controls.maxDistance = 6;

    this.viewer = new GaussianSplats3D.Viewer({
      selfDrivenMode: false,
      renderer: this.renderer,
      camera: this.camera,
      useBuiltInControls: false,
      threeScene: this.scene,
      ignoreDevicePixelRatio: false,
      sharedMemoryForWorkers: typeof SharedArrayBuffer !== 'undefined',
      dynamicScene: true
    });

    this.resetCamera();
    this.buildStageHelpers();
    this.resize();
    window.addEventListener('resize', this.resize);
    this.tick();
  }

  async loadSplat(url: string, cameraPreset?: CameraPreset): Promise<void> {
    this.options.onStatus('正在加载高斯模型...');
    this.clearFallback();
    if (this.platform) this.platform.visible = false;
    await this.clearSplatScenes();
    await this.viewer.addSplatScene(url, {
      showLoadingUI: false,
      splatAlphaRemovalThreshold: 5,
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1]
    });
    this.splatSceneCount = 1;
    if (cameraPreset) this.applyCameraPreset(cameraPreset);
    else this.resetCamera();
    this.options.onStatus('模型已加载，可以旋转、缩放和播放镜头。');
  }

  showFallbackProduct(): void {
    this.clearFallback();
    if (this.platform) this.platform.visible = true;
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.38, 0.85, 12, 32),
      new THREE.MeshStandardMaterial({
        color: 0xe86f4f,
        roughness: 0.48,
        metalness: 0.05
      })
    );
    body.rotation.z = 0.08;
    group.add(body);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.28, 0.14, 32),
      new THREE.MeshStandardMaterial({ color: 0x20242d, roughness: 0.35 })
    );
    cap.position.y = 0.56;
    group.add(cap);

    this.fallbackGroup = group;
    this.scene.add(group);
  }

  resetCamera(): void {
    this.camera.position.set(0.04, 0.55, 2.65);
    this.camera.fov = 42;
    this.camera.near = 0.02;
    this.camera.far = 500;
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(PRODUCT_TARGET);
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(PRODUCT_TARGET);
    this.controls.minDistance = 0.15;
    this.controls.maxDistance = 6;
    this.controls.update();
  }

  applyCameraPreset(preset: CameraPreset): void {
    const target = new THREE.Vector3(...preset.lookAt);
    this.camera.position.set(...preset.position);
    this.camera.up.fromArray(preset.up ?? [0, 1, 0]).normalize();
    this.camera.fov = preset.fov ?? 48;
    this.camera.near = 0.02;
    this.camera.far = 500;
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(target);
    this.controls.minDistance = 0.05;
    this.controls.maxDistance = preset.maxDistance ?? 20;
    this.controls.update();
  }

  getCameraSnapshot(): CameraSnapshot {
    const position = this.camera.position;
    const target = this.controls.target;
    const up = this.camera.up;
    return {
      position: roundTuple([position.x, position.y, position.z]),
      lookAt: roundTuple([target.x, target.y, target.z]),
      up: roundTuple([up.x, up.y, up.z]),
      fov: roundNumber(this.camera.fov),
      distance: roundNumber(position.distanceTo(target)),
      maxDistance: roundNumber(this.controls.maxDistance)
    };
  }

  dispose(): void {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.resize);
    this.controls.dispose();
    void this.viewer.dispose();
    this.renderer.dispose();
  }

  private readonly resize = (): void => {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private tick = (): void => {
    this.frameId = requestAnimationFrame(this.tick);
    const dt = this.clock.getDelta();
    this.controls.update();
    if (this.fallbackGroup) {
      this.fallbackGroup.rotation.y += dt * 0.28;
    }
    this.viewer.update();
    this.viewer.render();
  };

  private buildStageHelpers(): void {
    const hemi = new THREE.HemisphereLight(0xffffff, 0xbfc6d2, 1.2);
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(2, 3, 4);
    this.scene.add(hemi, key);

    this.platform = new THREE.Mesh(
      new THREE.CircleGeometry(0.92, 64),
      new THREE.MeshBasicMaterial({ color: 0xe4e7ee, transparent: true, opacity: 0.72 })
    );
    this.platform.rotation.x = -Math.PI / 2;
    this.platform.position.y = -0.84;
    this.scene.add(this.platform);
  }

  private clearFallback(): void {
    if (!this.fallbackGroup) return;
    this.scene.remove(this.fallbackGroup);
    this.fallbackGroup.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    this.fallbackGroup = undefined;
  }

  private async clearSplatScenes(): Promise<void> {
    if (this.splatSceneCount <= 0) return;
    const indexes = Array.from({ length: this.splatSceneCount }, (_value, index) => index);
    await this.viewer.removeSplatScenes(indexes, false);
    this.splatSceneCount = 0;
  }
}

function roundNumber(value: number): number {
  return Number(value.toFixed(4));
}

function roundTuple(value: [number, number, number]): [number, number, number] {
  return [roundNumber(value[0]), roundNumber(value[1]), roundNumber(value[2])];
}
