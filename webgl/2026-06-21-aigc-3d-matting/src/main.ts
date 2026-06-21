/**
 * 3D 空间 AIGC 元素调配器 — 主入口
 *
 * 管线：
 *   绿幕 MP4 → VideoTexture → Chroma Key ShaderMaterial（透明抠像）
 *   → PlaneGeometry（视频比例）→ 放入 3D 场景（与 Box 道具有深度关系）
 *   → 相机水平 Pan 展示真实透视
 */

import * as THREE from 'three';
import { createChromaKeyMaterial, sampleKeyColorFromVideo } from './shaders/chromaKeyShader';
import { initControlsPanel, mattingConfig } from './controlsPanel';

// ─── DOM ───────────────────────────────────────────────────────────
const viewportWrap = document.getElementById('viewport-wrap')!;
const panelMount = document.getElementById('controls-panel-mount')!;
const statusEl = document.getElementById('status')!;
const hudEl = document.getElementById('hud')!;

function setStatus(text: string) {
  statusEl.textContent = text;
}

// ─── 场景 / 相机 / 渲染器 ───────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0c12);
scene.fog = new THREE.Fog(0x0a0c12, 8, 22);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 1.6, 6);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
viewportWrap.appendChild(renderer.domElement);

// ─── 3D 空间参照：网格 + 坐标轴 ─────────────────────────────────────
// GridHelper(size, divisions) — 地面网格，标记 XZ 平面
const grid = new THREE.GridHelper(16, 16, 0x3a5080, 0x1a2840);
grid.position.y = 0;
scene.add(grid);

// AxesHelper(size) — RGB = XYZ 轴（红 X / 绿 Y / 蓝 Z）
scene.add(new THREE.AxesHelper(3));

// ─── 环境光 + 定向光（让 Box 有体积感）────────────────────────────────
scene.add(new THREE.AmbientLight(0x404860, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(4, 8, 5);
scene.add(dirLight);

// ─── 静态 3D 道具：彩色 Box ─────────────────────────────────────────
function addPropBox(x: number, y: number, z: number, color: number, size = 1) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15 }),
  );
  mesh.position.set(x, y + size / 2, z);
  mesh.castShadow = false;
  scene.add(mesh);
  return mesh;
}

// 前景 / 后景 Box，视频 Plane 将夹在它们之间
addPropBox(-2.5, 0, -2, 0xff6b6b, 1.2);
addPropBox(2.8, 0, 1.5, 0x6bcbff, 0.9);
addPropBox(-1.2, 0, 2.5, 0xffd166, 1.4);
addPropBox(3.2, 0, -1.8, 0xb388ff, 0.7);

// 地面参考平面（弱反射感）
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 16),
  new THREE.MeshStandardMaterial({ color: 0x121820, roughness: 0.9 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0.001;
scene.add(floor);

// ─── 视频主体 Plane ───────────────────────────────────────────────────
let subjectPlane: THREE.Mesh | null = null;
let videoTexture: THREE.VideoTexture | null = null;
let activeVideo: HTMLVideoElement | null = null;
let chromaUniforms: ReturnType<typeof createChromaKeyMaterial>['uniforms'] | null = null;

function applyAutoKeyColor(video: HTMLVideoElement) {
  if (!chromaUniforms) return;
  const hex = sampleKeyColorFromVideo(video);
  mattingConfig.keyColorHex = hex;
  chromaUniforms.uKeyColor.value.setHex(hex);
}
let videoAspect = 16 / 9;
/** Plane 宽度（世界单位），高度按视频比例推算 */
const SUBJECT_PLANE_WIDTH = 2.4;

function buildSubjectPlane(material: THREE.Material) {
  if (subjectPlane) {
    scene.remove(subjectPlane);
    subjectPlane.geometry.dispose();
    (subjectPlane.material as THREE.Material).dispose();
  }

  const height = SUBJECT_PLANE_WIDTH / videoAspect;
  const geometry = new THREE.PlaneGeometry(SUBJECT_PLANE_WIDTH, height);
  subjectPlane = new THREE.Mesh(geometry, material);

  // 置于场景中央，Z 在前后 Box 之间，略抬高模拟「站立主体」
  subjectPlane.position.set(0, 1.2 + height / 2, 0.3);
  subjectPlane.renderOrder = 2;
  scene.add(subjectPlane);
}

// ─── 绿幕占位视频（Canvas 绘制）──────────────────────────────────────
function createProceduralGreenscreenVideo(): HTMLVideoElement {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d')!;

  const stream = canvas.captureStream(30);
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.loop = true;
  void video.play();

  let t = 0;
  const draw = () => {
    t += 0.016;
    const w = canvas.width;
    const h = canvas.height;

    // 广播级纯绿背景 #00FF00 — 抠像 Key Color 默认匹配
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(0, 0, w, h);

    // 模拟 AIGC 主体：简单人形 + 色块，在绿幕前移动
    const cx = w * 0.5 + Math.sin(t * 0.6) * 40;
    const cy = h * 0.55;

    ctx.fillStyle = '#2a2a3a';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 70, 55, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e8a0b0';
    ctx.beginPath();
    ctx.arc(cx, cy - 50, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4a6fa5';
    ctx.fillRect(cx - 32, cy - 22, 64, 90);

    ctx.fillStyle = '#333';
    ctx.fillRect(cx - 38, cy + 68, 28, 55);
    ctx.fillRect(cx + 10, cy + 68, 28, 55);

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('AIGC SUBJECT', cx - 52, cy - 90);

    requestAnimationFrame(draw);
  };
  draw();
  return video;
}

async function createVideoElement(): Promise<{ video: HTMLVideoElement; source: string }> {
  const candidates = [
    { src: '/greenscreen.mp4', label: 'greenscreen.mp4' },
    { src: '/sample.mp4', label: 'sample.mp4（非绿幕）' },
  ];

  for (const { src, label } of candidates) {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const ok = await new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => finish(false), 8000);
      const finish = (result: boolean) => {
        window.clearTimeout(timeout);
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('error', onError);
        resolve(result);
      };
      const onReady = async () => {
        try {
          await video.play();
          // 必须能解码出有效帧，否则浏览器不支持该编码（如 OpenCV 的 mp4v）
          if (video.videoWidth > 0 && video.readyState >= 2) {
            finish(true);
          } else {
            finish(false);
          }
        } catch {
          finish(false);
        }
      };
      const onError = () => finish(false);
      video.src = src;
      video.load();
      video.addEventListener('loadeddata', onReady);
      video.addEventListener('error', onError);
    });

    if (ok) {
      return { video, source: label };
    }
    video.removeAttribute('src');
    video.load();
  }

  setStatus('MP4 无法播放，使用 Canvas 绿幕占位…');
  return { video: createProceduralGreenscreenVideo(), source: '程序绿幕占位（Canvas）' };
}

// ─── 运镜：水平 Pan ───────────────────────────────────────────────────
const clock = new THREE.Clock();
const cameraBase = new THREE.Vector3(0, 1.6, 6);
const lookTarget = new THREE.Vector3(0, 1, 0);

function updateCameraPan(elapsed: number) {
  const { panAmplitude, panDurationSec } = mattingConfig;
  const phase = (elapsed / panDurationSec) * Math.PI * 2;
  camera.position.x = cameraBase.x + Math.sin(phase) * panAmplitude;
  camera.position.y = cameraBase.y;
  camera.position.z = cameraBase.z;
  camera.lookAt(lookTarget);
}

// ─── 初始化 ─────────────────────────────────────────────────────────
async function init() {
  setStatus('加载绿幕视频…');

  const { video, source } = await createVideoElement();
  activeVideo = video;

  const syncAspect = () => {
    if (video.videoWidth > 0) {
      videoAspect = video.videoWidth / video.videoHeight;
      if (subjectPlane) {
        const mat = subjectPlane.material as THREE.ShaderMaterial;
        buildSubjectPlane(mat);
      }
    }
  };
  video.addEventListener('loadedmetadata', syncAspect);
  video.addEventListener('loadeddata', syncAspect);
  syncAspect();

  videoTexture = new THREE.VideoTexture(video);
  videoTexture.colorSpace = THREE.SRGBColorSpace;
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;

  const { material, uniforms } = createChromaKeyMaterial(videoTexture);
  chromaUniforms = uniforms;
  buildSubjectPlane(material);

  if (video.readyState >= 2) {
    applyAutoKeyColor(video);
  } else {
    video.addEventListener('loadeddata', () => applyAutoKeyColor(video), { once: true });
  }

  initControlsPanel(panelMount, uniforms, handleResize, () => applyAutoKeyColor(video));
  handleResize();

  setStatus(`视频源：${source} · 3D 场景已就绪 · 水平 Pan 运镜中`);
  setTimeout(() => hudEl.classList.add('hidden'), 4000);

  animate();
}

function handleResize() {
  const w = viewportWrap.clientWidth;
  const h = viewportWrap.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();
  updateCameraPan(elapsed);

  if (activeVideo && activeVideo.paused) {
    void activeVideo.play().catch(() => undefined);
  }
  if (videoTexture) {
    videoTexture.needsUpdate = true;
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', handleResize);
new ResizeObserver(handleResize).observe(viewportWrap);
new ResizeObserver(handleResize).observe(panelMount);

void init();
