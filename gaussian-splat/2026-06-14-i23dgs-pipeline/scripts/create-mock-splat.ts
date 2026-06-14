import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface SplatPoint {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outputPath = path.join(root, 'public', 'mock', 'product.splat');
const rowSize = 32;

function rand(min = 0, max = 1): number {
  return min + Math.random() * (max - min);
}

function randomNormal(): number {
  const u = Math.max(Math.random(), 1e-6);
  const v = Math.max(Math.random(), 1e-6);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function addEllipsoidSurface(
  points: SplatPoint[],
  count: number,
  center: [number, number, number],
  radii: [number, number, number],
  color: [number, number, number],
  scale: number,
  jitter = 0.015
): void {
  for (let i = 0; i < count; i += 1) {
    const theta = rand(0, Math.PI * 2);
    const phi = Math.acos(rand(-1, 1));
    const shell = 0.92 + rand(-0.04, 0.08);
    points.push({
      x: center[0] + Math.sin(phi) * Math.cos(theta) * radii[0] * shell + randomNormal() * jitter,
      y: center[1] + Math.cos(phi) * radii[1] * shell + randomNormal() * jitter,
      z: center[2] + Math.sin(phi) * Math.sin(theta) * radii[2] * shell + randomNormal() * jitter,
      sx: scale * rand(0.7, 1.25),
      sy: scale * rand(0.7, 1.35),
      sz: scale * rand(0.7, 1.2),
      r: color[0] + rand(-10, 18),
      g: color[1] + rand(-8, 16),
      b: color[2] + rand(-8, 16),
      a: rand(175, 235)
    });
  }
}

function addTorusBand(
  points: SplatPoint[],
  count: number,
  center: [number, number, number],
  majorRadius: number,
  tubeRadius: number,
  color: [number, number, number],
  scale: number,
  sideTilt: number
): void {
  for (let i = 0; i < count; i += 1) {
    const u = rand(0, Math.PI * 2);
    const v = rand(0, Math.PI * 2);
    const localX = (majorRadius + tubeRadius * Math.cos(v)) * Math.cos(u);
    const localY = tubeRadius * Math.sin(v);
    const localZ = (majorRadius * 0.34 + tubeRadius * Math.cos(v)) * Math.sin(u);
    points.push({
      x: center[0] + localX * Math.cos(sideTilt) + localZ * Math.sin(sideTilt) + randomNormal() * 0.01,
      y: center[1] + localY + randomNormal() * 0.01,
      z: center[2] - localX * Math.sin(sideTilt) + localZ * Math.cos(sideTilt) + randomNormal() * 0.01,
      sx: scale * rand(0.75, 1.3),
      sy: scale * rand(0.75, 1.3),
      sz: scale * rand(0.75, 1.3),
      r: color[0] + rand(-10, 16),
      g: color[1] + rand(-10, 16),
      b: color[2] + rand(-10, 16),
      a: rand(160, 225)
    });
  }
}

function addArcTube(
  points: SplatPoint[],
  count: number,
  color: [number, number, number],
  scale: number
): void {
  for (let i = 0; i < count; i += 1) {
    const t = rand(0.08, 0.92);
    const angle = Math.PI * t;
    const radiusX = 0.96;
    const radiusY = 1.05;
    const tubeAngle = rand(0, Math.PI * 2);
    const tube = rand(0.035, 0.075);
    const x = Math.cos(angle) * radiusX;
    const y = 0.02 + Math.sin(angle) * radiusY;
    const z = -0.05 + Math.sin(tubeAngle) * tube * 1.7;
    points.push({
      x: x + Math.cos(tubeAngle) * tube * Math.cos(angle) * 0.8 + randomNormal() * 0.012,
      y: y + Math.cos(tubeAngle) * tube * Math.sin(angle) * 0.5 + randomNormal() * 0.012,
      z,
      sx: scale * rand(0.9, 1.45),
      sy: scale * rand(0.9, 1.45),
      sz: scale * rand(0.9, 1.45),
      r: color[0] + rand(-8, 14),
      g: color[1] + rand(-8, 14),
      b: color[2] + rand(-8, 14),
      a: rand(175, 235)
    });
  }
}

function addConnector(
  points: SplatPoint[],
  count: number,
  x: number,
  color: [number, number, number]
): void {
  for (let i = 0; i < count; i += 1) {
    const t = rand(0, 1);
    const ring = rand(0, Math.PI * 2);
    const radius = rand(0.018, 0.038);
    points.push({
      x: x + Math.cos(ring) * radius,
      y: -0.05 + t * 0.33 + randomNormal() * 0.008,
      z: -0.02 + Math.sin(ring) * radius,
      sx: rand(0.016, 0.028),
      sy: rand(0.016, 0.032),
      sz: rand(0.016, 0.028),
      r: color[0] + rand(-12, 18),
      g: color[1] + rand(-12, 18),
      b: color[2] + rand(-12, 18),
      a: rand(190, 245)
    });
  }
}

function buildHeadphones(): SplatPoint[] {
  const points: SplatPoint[] = [];
  const shell = [14, 24, 27] as [number, number, number];
  const fabric = [26, 42, 45] as [number, number, number];
  const highlight = [52, 72, 76] as [number, number, number];
  const metal = [178, 190, 188] as [number, number, number];

  // 两个耳罩参考照片里的大椭圆体：左耳罩偏正面，右耳罩略向后倾。
  addEllipsoidSurface(points, 1900, [-0.48, -0.55, 0.08], [0.44, 0.5, 0.22], shell, 0.034, 0.018);
  addEllipsoidSurface(points, 1800, [0.55, -0.48, -0.02], [0.32, 0.54, 0.24], shell, 0.032, 0.018);

  // 耳垫用更粗糙的暗色环带表示，贴近原图的织物纹理。
  addTorusBand(points, 1250, [-0.48, -0.55, 0.18], 0.34, 0.075, fabric, 0.025, -0.12);
  addTorusBand(points, 1250, [0.55, -0.48, 0.13], 0.28, 0.07, fabric, 0.024, 0.42);

  // 头梁是一段上拱的厚管，内侧加一条浅色高光模拟织物反光。
  addArcTube(points, 2200, shell, 0.026);
  addArcTube(points, 760, highlight, 0.015);

  // 金属连接件让耳罩和头梁的结构读得出来。
  addConnector(points, 480, -0.78, metal);
  addConnector(points, 480, 0.78, metal);

  return points;
}

function writeSplatRow(view: DataView, bytes: Uint8Array, index: number, p: SplatPoint): void {
  const offset = index * rowSize;
  view.setFloat32(offset + 0, p.x, true);
  view.setFloat32(offset + 4, p.y, true);
  view.setFloat32(offset + 8, p.z, true);
  view.setFloat32(offset + 12, p.sx, true);
  view.setFloat32(offset + 16, p.sy, true);
  view.setFloat32(offset + 20, p.sz, true);
  bytes[offset + 24] = clampByte(p.r);
  bytes[offset + 25] = clampByte(p.g);
  bytes[offset + 26] = clampByte(p.b);
  bytes[offset + 27] = clampByte(p.a);

  // Quaternion encoded as 4 unsigned bytes around 128, matching the common .splat layout.
  bytes[offset + 28] = 255;
  bytes[offset + 29] = 128;
  bytes[offset + 30] = 128;
  bytes[offset + 31] = 128;
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
const points = buildHeadphones();
const buffer = new ArrayBuffer(points.length * rowSize);
const view = new DataView(buffer);
const bytes = new Uint8Array(buffer);
points.forEach((point, index) => writeSplatRow(view, bytes, index, point));
await fs.writeFile(outputPath, bytes);
console.log(`wrote ${points.length} headphone splats to ${outputPath}`);
