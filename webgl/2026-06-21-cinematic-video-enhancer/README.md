# 实时电影质感 AI 视频增强器

将普通 MP4（或程序占位画面）经 `VideoTexture` 贴到全屏平面，通过 **EffectComposer** 后期管线赋予《银翼杀手 2049》式废土科幻质感。

## 依赖

仅需 **Three.js** 本体；后期 Pass 来自官方 examples（随 `three` 包安装，无需额外 npm 包）：

| 包 | 用途 |
|----|------|
| `three` | 核心渲染、`VideoTexture`、`WebGLRenderer` |
| `three/examples/jsm/postprocessing/EffectComposer` | 后期合成器 |
| `three/examples/jsm/postprocessing/RenderPass` | 场景渲染 Pass |
| `three/examples/jsm/postprocessing/UnrealBloomPass` | 赛博朋克辉光 |
| `three/examples/jsm/postprocessing/ShaderPass` | 自定义胶片颗粒 Pass |

开发依赖：`vite`、`typescript`、`@types/three`。

## 运行

```bash
cd webgl/2026-06-21-cinematic-video-enhancer
npm install
npm run dev
```

浏览器打开 http://127.0.0.1:5174

## 替换视频

将 MP4 放到 `public/sample.mp4`。未放置时自动使用 Canvas 生成的赛博朋克占位动画。

## 代码结构

```
src/main.ts                    ← 场景、VideoTexture、EffectComposer、Dolly 运镜
src/shaders/filmGrainShader.ts ← 胶片颗粒 GLSL（含逐行数学注释）
```
