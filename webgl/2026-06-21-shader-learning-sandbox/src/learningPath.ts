/**
 * 一步学习路径 — 按钮切换即切换 Uniform / Fragment / Varying 实验
 */
export type LessonId =
  | 'uniform-1x'
  | 'uniform-2x'
  | 'uniform-4x'
  | 'frag-sincos'
  | 'frag-all-sin'
  | 'frag-all-cos'
  | 'frag-rainbow'
  | 'varying-vcolor';

export type Lesson = {
  id: LessonId;
  group: 'uniform' | 'fragment' | 'varying';
  title: string;
  hint: string;
  codeRef: string;
  timeSpeed: number;
  preset: number;
  fragVariant: number;
};

export const LESSON_GROUPS = [
  { key: 'uniform' as const, label: '① 理解 Uniforms（CPU → GPU）' },
  { key: 'fragment' as const, label: '② 修改 Fragment Shader' },
  { key: 'varying' as const, label: '③ 理解 Varying 插值' },
];

export const LESSONS: Lesson[] = [
  {
    id: 'uniform-1x',
    group: 'uniform',
    title: '时间 1×（正常）',
    hint: 'useFrame 里 uTime = elapsedTime × 1。彩虹球正常变色速度。',
    codeRef: 'ShaderSphere.tsx → mat.uniforms.uTime.value',
    timeSpeed: 1,
    preset: 1,
    fragVariant: 0,
  },
  {
    id: 'uniform-2x',
    group: 'uniform',
    title: '时间 2×（加快）',
    hint: '等价于在 useFrame 里乘 2.0 — 动画明显变快，Uniform 每帧喂给 GPU 的值更大。',
    codeRef: 'ShaderSphere.tsx → × TIME_SPEED(2)',
    timeSpeed: 2,
    preset: 1,
    fragVariant: 0,
  },
  {
    id: 'uniform-4x',
    group: 'uniform',
    title: '时间 4×（很快）',
    hint: '乘 4.0 — 感受 CPU 改一个数，GPU 上所有像素公式都变快。',
    codeRef: 'ShaderSphere.tsx → × TIME_SPEED(4)',
    timeSpeed: 4,
    preset: 1,
    fragVariant: 0,
  },
  {
    id: 'frag-sincos',
    group: 'fragment',
    title: '左 sin · 右 cos',
    hint: '左半球 sin 条纹、右半球 cos 条纹 — 条纹错开即 sin/cos 相位差。',
    codeRef: 'fragmentShader.ts → uPreset 0, sin/cos 各半',
    timeSpeed: 2,
    preset: 0,
    fragVariant: 0,
  },
  {
    id: 'frag-all-sin',
    group: 'fragment',
    title: '左右都用 sin',
    hint: '对比上一项：两边条纹同步，看不出左右差。',
    codeRef: 'fragmentShader.ts → fragVariant 1',
    timeSpeed: 2,
    preset: 0,
    fragVariant: 1,
  },
  {
    id: 'frag-all-cos',
    group: 'fragment',
    title: '左右都用 cos',
    hint: '与 sin 对比：整体色调和条纹节奏不同。',
    codeRef: 'fragmentShader.ts → fragVariant 2',
    timeSpeed: 2,
    preset: 0,
    fragVariant: 2,
  },
  {
    id: 'frag-rainbow',
    group: 'fragment',
    title: '彩虹球 + 鼠标热点',
    hint: 'R=sin(uTime) G/B=波形 — 改 fragment 里 sin→cos 看 R 通道变化。',
    codeRef: 'fragmentShader.ts → uPreset 1',
    timeSpeed: 2,
    preset: 1,
    fragVariant: 0,
  },
  {
    id: 'varying-vcolor',
    group: 'varying',
    title: 'vColor 顶点渐变',
    hint: '颜色在 Vertex 按 uv 算出，Fragment 只接收插值后的 vColor — GPU 插值魔法。',
    codeRef: 'vertexShader.ts → vColor = vec3(uv.x, uv.y, …)',
    timeSpeed: 1,
    preset: 3,
    fragVariant: 0,
  },
];

export function lessonById(id: LessonId): Lesson {
  return LESSONS.find((l) => l.id === id) ?? LESSONS[0];
}
