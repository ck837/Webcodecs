import * as THREE from 'three';

export interface CameraKeyframe {
  time: number;
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export const PRODUCT_TARGET = new THREE.Vector3(0, 0.08, 0);

export const cameraKeyframes: CameraKeyframe[] = [
  {
    time: 0,
    position: new THREE.Vector3(0, 0.55, 2.8),
    target: PRODUCT_TARGET.clone(),
    fov: 42
  },
  {
    time: 0.34,
    position: new THREE.Vector3(2.25, 0.62, 1.35),
    target: PRODUCT_TARGET.clone(),
    fov: 38
  },
  {
    time: 0.68,
    position: new THREE.Vector3(-2.15, 0.92, -1.2),
    target: new THREE.Vector3(0, 0.2, 0),
    fov: 35
  },
  {
    time: 1,
    position: new THREE.Vector3(0.32, 0.24, 1.08),
    target: new THREE.Vector3(0, 0.28, 0),
    fov: 30
  }
];

export function applyCameraPath(camera: THREE.PerspectiveCamera, progress: number): void {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  let a = cameraKeyframes[0];
  let b = cameraKeyframes[cameraKeyframes.length - 1];
  for (let i = 0; i < cameraKeyframes.length - 1; i += 1) {
    if (t >= cameraKeyframes[i].time && t <= cameraKeyframes[i + 1].time) {
      a = cameraKeyframes[i];
      b = cameraKeyframes[i + 1];
      break;
    }
  }

  const span = Math.max(0.0001, b.time - a.time);
  const local = smoothstep((t - a.time) / span);
  camera.position.lerpVectors(a.position, b.position, local);
  const target = new THREE.Vector3().lerpVectors(a.target, b.target, local);

  // FOV 越小，画面越像长焦特写；这里和位置一起插值，避免推进时画面突然跳变。
  camera.fov = THREE.MathUtils.lerp(a.fov, b.fov, local);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}

function smoothstep(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}
