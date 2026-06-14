import * as THREE from 'three';

export const PRODUCT_TARGET = new THREE.Vector3(0, 0.08, 0);

export interface OrbitAnimationState {
  target: THREE.Vector3;
  radius: number;
  height: number;
  startAngle: number;
  startFov: number;
  up: THREE.Vector3;
  basisRight: THREE.Vector3;
  basisForward: THREE.Vector3;
}

export function createOrbitAnimationState(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3
): OrbitAnimationState {
  const up = camera.up.clone().normalize();
  const offset = camera.position.clone().sub(target);
  const height = offset.dot(up);
  const planar = offset.clone().sub(up.clone().multiplyScalar(height));
  const radius = Math.max(0.01, planar.length());
  const basisRight = radius > 0.01 ? planar.clone().normalize() : new THREE.Vector3(1, 0, 0);
  const basisForward = new THREE.Vector3().crossVectors(up, basisRight).normalize();

  return {
    target: target.clone(),
    radius,
    height,
    startAngle: 0,
    startFov: camera.fov,
    up,
    basisRight,
    basisForward
  };
}

export function applyOrbitAnimation(
  camera: THREE.PerspectiveCamera,
  state: OrbitAnimationState,
  progress: number
): void {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  const eased = smoothstep(t);
  const angle = state.startAngle + eased * Math.PI * 2;
  const radial = state.basisRight.clone().multiplyScalar(Math.cos(angle) * state.radius)
    .add(state.basisForward.clone().multiplyScalar(Math.sin(angle) * state.radius));

  // Orbit in the active scene's camera-up coordinate frame, so official 3DGS
  // scenes keep their intended orientation. No fixed world-Y center is used.
  camera.position.copy(state.target)
    .add(state.up.clone().multiplyScalar(state.height))
    .add(radial);
  camera.up.copy(state.up);
  camera.fov = state.startFov;
  camera.lookAt(state.target);
  camera.updateProjectionMatrix();
}

function smoothstep(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}
