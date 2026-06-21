/**
 * uPreset: 0=sin/cos课 1=彩虹 2=UV调试 3=vColor课
 * uFragVariant: 0=左sin右cos 1=全sin 2=全cos
 */

export const fragmentShaderCode = /* glsl */ `
uniform float uTime;
uniform vec2 uMousePosition;
uniform float uPreset;
uniform float uFragVariant;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vColor;

void main() {
  // ── ③ Varying 课：直接用顶点传来的 vColor（已插值）──
  if (uPreset > 2.5) {
    gl_FragColor = vec4(vColor, 1.0);
    return;
  }

  // ── ② Fragment 课 · sin/cos 对比 ──
  if (uPreset < 0.5) {
    float stripes = vUv.x * 24.0 + uTime * 4.0;
    float left  = sin(stripes) * 0.5 + 0.5;
    float right = cos(stripes) * 0.5 + 0.5;

    if (uFragVariant > 0.5 && uFragVariant < 1.5) {
      right = sin(stripes) * 0.5 + 0.5;
    } else if (uFragVariant > 1.5) {
      left = cos(stripes) * 0.5 + 0.5;
      right = cos(stripes) * 0.5 + 0.5;
    }

    float isRight = step(0.5, vUv.x);
    float band = mix(left, right, isRight);
    vec3 col = mix(vec3(band, 0.05, 0.05), vec3(0.05, band, 0.2), isRight);
    gl_FragColor = vec4(col, 1.0);
    return;
  }

  if (uPreset > 1.5 && uPreset < 2.5) {
    gl_FragColor = vec4(vUv, sin(uTime) * 0.5 + 0.5, 1.0);
    return;
  }

  // ── ① Uniform 课 · 彩虹（速度由 JS 的 timeSpeed 控制）──
  float wave = sin(vUv.x * 10.0 + uTime * 2.0) * 0.5 + 0.5;
  float wave2 = cos(vUv.y * 8.0 - uTime * 1.5) * 0.5 + 0.5;

  vec3 baseColor = vec3(
    sin(uTime + vUv.x * 6.283) * 0.5 + 0.5,
    wave * 0.6 + 0.2,
    wave2 * 0.8 + 0.1
  );

  float dist = length(vUv - uMousePosition);
  float mouseGlow = 0.5 / (dist * 5.0 + 0.06);
  float ndotl = dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)) * 0.4 + 0.6;

  gl_FragColor = vec4((baseColor + mouseGlow) * ndotl, 1.0);
}
`;
