import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Lesson } from '../learningPath';
import { fragmentShaderCode } from '../shaders/fragmentShader';
import { vertexShaderCode } from '../shaders/vertexShader';

export type ShaderSphereProps = {
  mouseUv: THREE.Vector2;
  lesson: Lesson;
};

export function ShaderSphere({ mouseUv, lesson }: ShaderSphereProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMousePosition: { value: new THREE.Vector2(0.5, 0.5) },
      uPreset: { value: 0 },
      uFragVariant: { value: 0 },
    }),
    [],
  );

  useFrame((state) => {
    const mat = materialRef.current;
    const mesh = meshRef.current;
    if (!mat) return;

    mat.uniforms.uTime.value = state.clock.elapsedTime * lesson.timeSpeed;
    mat.uniforms.uMousePosition.value.copy(mouseUv);
    mat.uniforms.uPreset.value = lesson.preset;
    mat.uniforms.uFragVariant.value = lesson.fragVariant;

    if (mesh && lesson.preset !== 3) {
      mesh.rotation.y = state.clock.elapsedTime * 0.35;
      mesh.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.15;
    } else if (mesh) {
      mesh.rotation.set(0, 0, 0);
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.2, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShaderCode}
        fragmentShader={fragmentShaderCode}
        uniforms={uniforms}
      />
    </mesh>
  );
}
