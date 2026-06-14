/**
 * 导航走廊几何（CPU 贝塞尔管 + 流动极光 Shader）
 */
import * as THREE from 'three';

export const AURORA = 0x00e5ff;

function cubicBezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const uu = u * u, tt = t * t;
  return new THREE.Vector3(
    uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
    uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y,
    uu * u * p0.z + 3 * uu * t * p1.z + 3 * u * tt * p2.z + tt * t * p3.z
  );
}

function cubicBezierTan(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return new THREE.Vector3(
    3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
    3 * u * u * (p1.z - p0.z) + 6 * u * t * (p2.z - p1.z) + 3 * t * t * (p3.z - p2.z)
  );
}

export function buildBezierSegments(routePoints3, liftY = 0.35) {
  const pts = routePoints3.map(p => new THREE.Vector3(p.x, liftY, p.z));
  const segments = [];
  const segLens = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p3 = pts[i + 1];
    const prev = pts[Math.max(i - 1, 0)];
    const next = pts[Math.min(i + 2, pts.length - 1)];
    const p1 = new THREE.Vector3().addVectors(p0, new THREE.Vector3().subVectors(p3, prev).multiplyScalar(1 / 6));
    const p2 = new THREE.Vector3().subVectors(p3, new THREE.Vector3().subVectors(next, p0).multiplyScalar(1 / 6));
    segments.push({ p0, p1, p2, p3 });
    segLens.push(p0.distanceTo(p3));
  }
  const totalLen = segLens.reduce((a, b) => a + b, 0) || 1;
  return { segments, segLens, totalLen, segCount: segments.length };
}

function evalPath(bezierData, globalT) {
  const { segments, segLens, totalLen } = bezierData;
  let dist = globalT * totalLen;
  for (let i = 0; i < segments.length; i++) {
    const len = segLens[i];
    if (dist <= len || i === segments.length - 1) {
      const lt = len > 1e-4 ? dist / len : 0;
      const { p0, p1, p2, p3 } = segments[i];
      const pos = cubicBezier(p0, p1, p2, p3, THREE.MathUtils.clamp(lt, 0, 1));
      const tan = cubicBezierTan(p0, p1, p2, p3, THREE.MathUtils.clamp(lt, 0, 1));
      if (tan.lengthSq() < 1e-8) tan.set(0, 0, 1);
      tan.normalize();
      return { pos, tan };
    }
    dist -= len;
  }
  const last = segments[segments.length - 1];
  return { pos: last.p3.clone(), tan: new THREE.Vector3(0, 0, -1) };
}

/** 贴地半透明极光管，不依赖光照 / 深度 RT */
export function createCorridorMesh(bezierData, options = {}) {
  const radial = options.radialSegments ?? 10;
  const tubular = options.tubularSegments ?? 100;
  const radius = options.radius ?? 0.28;

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const tmpN = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= tubular; i++) {
    const gt = i / tubular;
    const { pos, tan } = evalPath(bezierData, gt);
    if (Math.abs(tan.dot(up)) > 0.92) up.set(1, 0, 0);
    else up.set(0, 1, 0);
    tmpN.crossVectors(tan, up).normalize();
    tmpB.crossVectors(tan, tmpN).normalize();

    for (let j = 0; j <= radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      const cx = Math.cos(ang) * radius;
      const cy = Math.sin(ang) * radius;
      positions.push(
        pos.x + tmpN.x * cx + tmpB.x * cy,
        pos.y + tmpN.y * cx + tmpB.y * cy,
        pos.z + tmpN.z * cx + tmpB.z * cy
      );
      normals.push(tmpN.x * cx + tmpB.x * cy, tmpN.y * cx + tmpB.y * cy, tmpN.z * cx + tmpB.z * cy);
      uvs.push(gt, j / radial);
    }
  }

  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: options.opacity ?? 0.36 },
      uColor: { value: new THREE.Color(options.color ?? AURORA) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main(){
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main(){
        float center = 1.0 - smoothstep(0.16, 0.5, abs(vUv.y - 0.5));
        float ribbon = 0.52 + 0.48 * sin(vUv.x * 38.0 - uTime * 3.4 + sin(vWorld.x * 0.18) * 1.2);
        float pulse = smoothstep(0.18, 0.95, ribbon);
        float scan = 0.75 + 0.25 * sin((vWorld.x + vWorld.z) * 0.9 + uTime * 2.0);
        vec3 magenta = vec3(1.0, 0.12, 0.72);
        vec3 color = mix(uColor, magenta, 0.2 + pulse * 0.22);
        float alpha = uOpacity * pow(center, 1.55) * (0.45 + pulse * 0.55) * scan;
        if(alpha < 0.012) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.userData.totalLen = bezierData.totalLen;
  return mesh;
}

export function updateCorridorUniforms(mesh, time, opacity, color) {
  const uniforms = mesh?.material?.uniforms;
  if (!uniforms) return;
  uniforms.uTime.value = time;
  if (opacity !== undefined) uniforms.uOpacity.value = opacity;
  if (color !== undefined) uniforms.uColor.value.set(color);
}
