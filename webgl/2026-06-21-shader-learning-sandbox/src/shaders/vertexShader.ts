export const vertexShaderCode = /* glsl */ `
uniform float uTime;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vColor;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);

  // Varying vColor：在顶点阶段按 uv 赋色，Fragment 收到的是插值后的渐变
  vColor = vec3(
    uv.x,
    uv.y,
    0.35 + 0.65 * sin(uv.y * 12.566 + uTime)
  );

  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewPosition;
}
`;
