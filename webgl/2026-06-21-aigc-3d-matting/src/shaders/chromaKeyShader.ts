import * as THREE from 'three';

/**
 * 绿幕抠像 Chroma Key ShaderMaterial
 *
 * 改进：在 YCbCr 色度平面 (Cb, Cr) 上算距离，忽略亮度 Y 的变化。
 * 这样绿幕上的阴影、高光（Y 变了但色相仍是绿）也能被稳定抠掉。
 *
 * 浅绿 / 渐变绿幕（如 Mixkit 甜甜圈）比纯 RGB 距离 + greenExcess 干净得多。
 */
export function createChromaKeyMaterial(videoTexture: THREE.VideoTexture) {
  const uniforms = {
    uVideo: { value: videoTexture },
    uKeyColor: { value: new THREE.Color(0x7f835e) },
    /** 色度距离阈值：越小抠得越狠（YCbCr 空间，典型 0.04~0.12） */
    uThreshold: { value: 0.07 },
    uSlope: { value: 0.035 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uVideo;
      uniform vec3 uKeyColor;
      uniform float uThreshold;
      uniform float uSlope;

      varying vec2 vUv;

      // BT.601：RGB → 色度 (Cb, Cr)，范围约 [0,1]
      vec2 rgbToCbCr(vec3 rgb) {
        return vec2(
          dot(rgb, vec3(-0.169, -0.331, 0.500)) + 0.5,
          dot(rgb, vec3(0.500, -0.419, -0.081)) + 0.5
        );
      }

      void main() {
        vec4 tex = texture2D(uVideo, vUv);
        vec3 color = tex.rgb;

        vec2 cbCr = rgbToCbCr(color);
        vec2 keyCbCr = rgbToCbCr(uKeyColor);

        // ── 主判定：色度平面距离 ──
        // 亮度 Y 不参与，绿幕阴影/渐变不会导致 dist 飙升 → 背景能抠干净
        float distChroma = distance(cbCr, keyCbCr);
        float alpha = smoothstep(
          uThreshold - uSlope,
          uThreshold + uSlope,
          distChroma
        );

        // ── 绿溢抑制：半透明边缘去掉多余 G，减轻绿边 ──
        float spill = max(0.0, color.g - max(color.r, color.b));
        color.g -= spill * (1.0 - alpha) * 0.9;

        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  return { material, uniforms };
}

export type ChromaUniforms = ReturnType<typeof createChromaKeyMaterial>['uniforms'];

/** 从视频四角采样平均色，作为 Key Color（适配每条素材的实际绿幕） */
export function sampleKeyColorFromVideo(video: HTMLVideoElement): number {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w === 0 || h === 0) return 0x7f835e;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0, w, h);

  // 四角 + 上边中点，避开画面中央主体
  const points: [number, number][] = [
    [0.04, 0.04],
    [0.96, 0.04],
    [0.04, 0.96],
    [0.96, 0.96],
    [0.5, 0.04],
    [0.04, 0.5],
    [0.96, 0.5],
  ];

  let r = 0;
  let g = 0;
  let b = 0;
  for (const [nx, ny] of points) {
    const x = Math.min(w - 1, Math.max(0, Math.floor(nx * w)));
    const y = Math.min(h - 1, Math.max(0, Math.floor(ny * h)));
    const p = ctx.getImageData(x, y, 1, 1).data;
    r += p[0];
    g += p[1];
    b += p[2];
  }
  const n = points.length;
  return ((Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n)) >>> 0;
}

export function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}
