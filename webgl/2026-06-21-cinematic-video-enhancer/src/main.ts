/**
 * 实时电影质感 AI 视频增强器 — 主入口
 *
 * 布局：左 = 原视频 · 中 = 电影增强 · 右 = 参数面板列
 *   右屏管线：RenderPass → UnrealBloomPass → FilmGrainPass
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FilmGrainShader } from './shaders/filmGrainShader';
import { enhanceConfig, initControlsPanel } from './controlsPanel';

// ─── DOM ───────────────────────────────────────────────────────────
const viewportWrap = document.getElementById('viewport-wrap')!;
const panelMount = document.getElementById('controls-panel-mount')!;
const statusEl = document.getElementById('status')!;
const overlayEl = document.getElementById('overlay')!;

function setStatus(text: string) {
  statusEl.textContent = text;
}

// ─── 运镜（数值由参数面板 enhanceConfig 驱动）────────────────────────

// ─── 场景 / 相机 / 渲染器 ───────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050508);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, enhanceConfig.cameraZStart);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.autoClear = false;
viewportWrap.appendChild(renderer.domElement);

// ─── 视频区尺寸（左侧 viewport-wrap，不含参数列）────────────────────
function getVideoLayout(): { videoW: number; videoH: number; halfW: number } {
  const videoW = viewportWrap.clientWidth;
  const videoH = viewportWrap.clientHeight;
  const halfW = Math.floor(videoW / 2);
  return { videoW, videoH, halfW };
}

/** 视频原始宽高比（宽/高），loadedmetadata 后更新 */
let videoAspect = 16 / 9;

/** 相机距离处，半屏视口在世界空间中的宽高 */
function getViewportWorldSize(distance: number): { viewWidth: number; viewHeight: number } {
  const vFovRad = THREE.MathUtils.degToRad(camera.fov);
  const viewHeight = 2 * Math.tan(vFovRad / 2) * distance;
  const viewWidth = viewHeight * camera.aspect;
  return { viewWidth, viewHeight };
}

/**
 * 按原比例「contain」适配：视频完整显示在半屏内，不拉伸、不裁切
 * 比例与面板不一致时，上下或左右留黑边（场景背景色）
 */
function getContainedPlaneSize(distance: number, aspect: number): { width: number; height: number } {
  const { viewWidth, viewHeight } = getViewportWorldSize(distance);
  const panelAspect = viewWidth / viewHeight;

  if (aspect > panelAspect) {
    // 视频更宽 → 以宽度为界，上下留边
    return { width: viewWidth, height: viewWidth / aspect };
  }
  // 视频更高 → 以高度为界，左右留边
  return { width: viewHeight * aspect, height: viewHeight };
}

let videoPlane: THREE.Mesh | null = null;
let videoTexture: THREE.VideoTexture | null = null;
let planeBaseWidth = 1;
let planeBaseHeight = 1;

function buildVideoPlane(texture: THREE.Texture) {
  if (videoPlane) {
    scene.remove(videoPlane);
    videoPlane.geometry.dispose();
    (videoPlane.material as THREE.Material).dispose();
  }

  const distance = camera.position.z;
  const { width, height } = getContainedPlaneSize(distance, videoAspect);
  planeBaseWidth = width;
  planeBaseHeight = height;

  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
  });

  videoPlane = new THREE.Mesh(geometry, material);
  scene.add(videoPlane);
}

function updatePlaneSize() {
  if (!videoPlane) return;
  const { width, height } = getContainedPlaneSize(camera.position.z, videoAspect);
  videoPlane.scale.set(width / planeBaseWidth, height / planeBaseHeight, 1);
}

function updateCameraAspect() {
  const { halfW, videoH } = getVideoLayout();
  camera.aspect = halfW / videoH;
  camera.updateProjectionMatrix();
}

// ─── 占位视频 ───────────────────────────────────────────────────────
function createProceduralVideoSource(): HTMLVideoElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
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

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0a0618');
    grad.addColorStop(0.5, '#12082a');
    grad.addColorStop(1, '#1a0e2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 8; i++) {
      const y = h * (0.15 + i * 0.1) + Math.sin(t * 0.5 + i) * 20;
      const hue = (200 + i * 25 + t * 10) % 360;
      ctx.fillStyle = `hsla(${hue}, 90%, 65%, 0.85)`;
      ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;
      ctx.shadowBlur = 40;
      ctx.fillRect(w * 0.1, y, w * 0.8, 4 + Math.sin(t + i) * 2);
    }
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(255, 110, 180, 0.6)';
    ctx.lineWidth = 2;
    const bx = w * 0.5 + Math.sin(t * 0.3) * 80 - 120;
    const by = h * 0.55 + Math.cos(t * 0.25) * 40;
    ctx.strokeRect(bx, by, 240, 140);
    ctx.fillStyle = 'rgba(255, 110, 180, 0.08)';
    ctx.fillRect(bx, by, 240, 140);

    ctx.fillStyle = 'rgba(232, 220, 240, 0.7)';
    ctx.font = '14px monospace';
    ctx.fillText('AI_GEN :: FRAME ' + Math.floor(t * 30), bx + 12, by + 28);
    ctx.fillText('NEON_PASS :: ACTIVE', bx + 12, by + 52);

    requestAnimationFrame(draw);
  };
  draw();

  return video;
}

async function createVideoElement(): Promise<{ video: HTMLVideoElement; source: string }> {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  const tryPlay = (src: string) =>
    new Promise<boolean>((resolve) => {
      const onReady = () => {
        cleanup();
        resolve(true);
      };
      const onError = () => {
        cleanup();
        resolve(false);
      };
      const cleanup = () => {
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('error', onError);
      };
      video.src = src;
      video.load();
      video.addEventListener('loadeddata', onReady);
      video.addEventListener('error', onError);
    });

  const localOk = await tryPlay('/sample.mp4');
  if (localOk) {
    await video.play();
    return { video, source: 'sample.mp4' };
  }

  setStatus('未找到 sample.mp4，使用程序占位画面…');
  return { video: createProceduralVideoSource(), source: 'procedural（Canvas 占位）' };
}

// ─── 后期处理（仅右半屏）────────────────────────────────────────────
let composer: EffectComposer;
let bloomPass: UnrealBloomPass;
let grainPass: ShaderPass;
let enhancedRenderPass: RenderPass;

function setupPostProcessing(halfW: number, fullH: number) {
  composer = new EffectComposer(renderer);
  composer.setSize(halfW, fullH);

  enhancedRenderPass = new RenderPass(scene, camera);
  enhancedRenderPass.clear = false; // 分屏：不清左半屏已绘制内容
  composer.addPass(enhancedRenderPass);

  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(halfW, fullH),
    enhanceConfig.bloomStrength,
    enhanceConfig.bloomRadius,
    enhanceConfig.bloomThreshold,
  );
  composer.addPass(bloomPass);

  grainPass = new ShaderPass(FilmGrainShader);
  grainPass.uniforms.uIntensity.value = enhanceConfig.grainIntensity;
  composer.addPass(grainPass);
}

/** 把面板参数同步到渲染器 / 后期 Pass */
function applyEnhanceConfig() {
  if (bloomPass) {
    bloomPass.strength = enhanceConfig.bloomStrength;
    bloomPass.radius = enhanceConfig.bloomRadius;
    bloomPass.threshold = enhanceConfig.bloomThreshold;
  }
  if (grainPass) {
    grainPass.uniforms.uIntensity.value = enhanceConfig.grainIntensity;
  }
  renderer.toneMappingExposure = enhanceConfig.toneMappingExposure;
}

/** 左原片 / 右增强 分屏渲染 */
function renderSplitView() {
  const { videoH, halfW } = getVideoLayout();
  const dpr = renderer.getPixelRatio();

  renderer.setScissorTest(true);
  renderer.setClearColor(0x050508, 1);

  // ── 左半屏：原视频直出（无 Bloom / 颗粒）──
  renderer.setViewport(0, 0, halfW, videoH);
  renderer.setScissor(0, 0, halfW, videoH);
  renderer.clear(true, true, true);
  renderer.render(scene, camera);

  grainPass.uniforms.uResolution.value.set(halfW * dpr, videoH * dpr);

  renderer.setViewport(halfW, 0, halfW, videoH);
  renderer.setScissor(halfW, 0, halfW, videoH);
  renderer.clear(true, true, true);
  composer.render();

  renderer.setScissorTest(false);
}

function handleResize() {
  const { videoW, videoH, halfW } = getVideoLayout();

  renderer.setSize(videoW, videoH);
  updateCameraAspect();
  if (composer) {
    composer.setSize(halfW, videoH);
    bloomPass.resolution.set(halfW, videoH);
  }
  updatePlaneSize();
}

// ─── 初始化 ─────────────────────────────────────────────────────────
async function init() {
  setStatus('加载视频源…');

  const { video, source } = await createVideoElement();

  videoTexture = new THREE.VideoTexture(video);
  videoTexture.colorSpace = THREE.SRGBColorSpace;
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;

  const syncVideoAspect = () => {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      videoAspect = video.videoWidth / video.videoHeight;
      updateCameraAspect();
      buildVideoPlane(videoTexture!);
      updatePlaneSize();
    }
  };
  video.addEventListener('loadedmetadata', syncVideoAspect);
  syncVideoAspect();

  updateCameraAspect();
  if (!videoPlane) buildVideoPlane(videoTexture);

  const { halfW, videoH } = getVideoLayout();
  setupPostProcessing(halfW, videoH);
  handleResize();
  initControlsPanel(panelMount, applyEnhanceConfig, handleResize);

  setStatus(`视频源：${source} · 左原片 · 中增强 · 右侧调参`);
  setTimeout(() => overlayEl.classList.add('hidden'), 3500);

  animate();
}

// ─── 主动画循环 ─────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();

  const { dollyEnabled, dollyDurationSec, cameraZStart, cameraZEnd } = enhanceConfig;
  if (dollyEnabled) {
    const cycle = (elapsed % dollyDurationSec) / dollyDurationSec;
    const eased = cycle < 0.5
      ? 2 * cycle * cycle
      : 1 - Math.pow(-2 * cycle + 2, 2) / 2;
    const zEnd = Math.min(cameraZEnd, cameraZStart - 0.1);
    camera.position.z = THREE.MathUtils.lerp(cameraZStart, zEnd, eased);
  } else {
    camera.position.z = cameraZStart;
  }

  updatePlaneSize();

  if (grainPass) {
    grainPass.uniforms.uTime.value = elapsed;
  }

  renderSplitView();
}

window.addEventListener('resize', handleResize);
new ResizeObserver(handleResize).observe(viewportWrap);
new ResizeObserver(handleResize).observe(panelMount);

void init();
