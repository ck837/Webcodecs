import * as THREE from 'three';

/**
 * FilmGrainPass 的 GLSL 着色器定义
 *
 * 设计目标：在 AI 生成视频常见的「过度平滑、塑料感」画面上，
 * 叠加随时间变化的胶片颗粒，模拟《银翼杀手 2049》式的物理介质质感。
 *
 * ShaderPass 约定：
 * - tDiffuse：上一个 Pass 输出的颜色纹理（Bloom 之后）
 * - uTime：全局时间，驱动颗粒「闪烁」
 * - uIntensity：颗粒强度（0~1）
 * - uResolution：屏幕像素尺寸，用于构造 per-pixel 随机种子
 */
export const FilmGrainShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uIntensity: { value: 0.18 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },

  /**
   * 顶点着色器：全屏四边形，仅传递 UV
   * EffectComposer 内部会用正交相机渲染一个覆盖视口的 Plane
   */
  vertexShader: /* glsl */ `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  /**
   * 片元着色器：核心数学逻辑
   *
   * 图形学要点：
   * 1. hash 函数 — 把 2D/3D 坐标映射为 [0,1) 伪随机数，无纹理采样开销
   * 2. 亮度加权 — 暗部颗粒略强、亮部略弱，接近真实胶片感光特性
   * 3. 时间调制 — 每帧改变随机相位，颗粒「活」起来而非静态噪点图
   */
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uIntensity;
    uniform vec2 uResolution;

    varying vec2 vUv;

    // ─────────────────────────────────────────────────────────────
    // hash11：一维 → 一维 伪随机
    // sin(p) 的小数部分具有混沌性；*43758.5453 是经典的 fract 放大常数
    // fract(x) = x - floor(x)，取小数部分，结果 ∈ [0, 1)
    // ─────────────────────────────────────────────────────────────
    float hash11(float p) {
      return fract(sin(p * 127.1) * 43758.5453123);
    }

    // ─────────────────────────────────────────────────────────────
    // hash21：二维像素坐标 → 一维随机
    // dot(st, vec2(12.9898, 78.233)) 把 (x,y) 混合成标量，减少轴向相关性
    // 不同像素即使相邻，点积结果也差异很大 → 颗粒独立
    // ─────────────────────────────────────────────────────────────
    float hash21(vec2 st) {
      return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    // ─────────────────────────────────────────────────────────────
    // filmGrain：返回 [-1, 1] 范围的颗粒偏移量
    // 使用像素坐标 + 时间 构造三维种子，避免缩放时颗粒「粘在 UV 上」
    // ─────────────────────────────────────────────────────────────
    float filmGrain(vec2 pixelCoord, float time) {
      // 将像素坐标与时间合并为浮点种子
      float seed = hash21(pixelCoord + vec2(time * 17.0, time * 13.0));

      // 第二层 hash 增加频谱复杂度，避免单一 sin 的带状 artifact
      float seed2 = hash11(seed * 91.7 + time * 0.37);

      // 映射到 [-1, 1]：0.5 为中心，乘以 2 再减 1
      return (seed * 0.6 + seed2 * 0.4) * 2.0 - 1.0;
    }

    void main() {
      // 采样 Bloom 处理后的颜色；vUv ∈ [0,1] 对应纹理坐标
      vec4 baseColor = texture2D(tDiffuse, vUv);
      vec3 color = baseColor.rgb;

      // 换算到像素坐标：乘以分辨率得到整数网格上的位置
      // 这样颗粒大小与屏幕像素 1:1 对应，不随窗口缩放变形
      vec2 pixelCoord = vUv * uResolution;

      // 计算当前像素的颗粒值
      float grain = filmGrain(pixelCoord, uTime);

      // ── 亮度加权 ──
      // luma = 0.299R + 0.587G + 0.114B（Rec.601 亮度系数）
      // 暗部 (luma 小) → weight 大 → 颗粒更明显，模拟胶片暗部粗颗粒
      // 亮部 (luma 大) → weight 小 → 避免高光区域被噪点弄脏
      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      float weight = mix(1.35, 0.55, smoothstep(0.15, 0.85, luma));

      // 将颗粒叠加到 RGB 通道
      // grain * uIntensity * weight：强度 × 亮度权重
      color += grain * uIntensity * weight;

      // 轻微去饱和 + 冷色调偏移，向废土科幻调色靠拢
      float avg = dot(color, vec3(0.3333));
      color = mix(vec3(avg), color, 0.88);
      color *= vec3(0.92, 0.96, 1.08);

      gl_FragColor = vec4(color, baseColor.a);
    }
  `,
};
