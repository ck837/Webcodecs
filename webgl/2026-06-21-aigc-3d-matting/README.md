# 3D 空间 AIGC 元素调配器

绿幕 MP4 经 **Chroma Key Shader** 实时抠像，透明主体贴到 **PlaneGeometry** 上，与 Box 道具共处真实 3D 空间，相机 **Pan** 展示透视关系。

## 依赖

| 包 | 用途 |
|----|------|
| `three` | 场景、VideoTexture、ShaderMaterial、GridHelper、AxesHelper |

无需额外 npm 包；纯 Three.js + Vite。

开发依赖：`vite`、`typescript`、`@types/three`。

## 运行

```bash
cd webgl/2026-06-21-aigc-3d-matting
npm install
npm run dev
```

http://127.0.0.1:5175

**教程：** http://127.0.0.1:5175/tutorial.html（Threshold / Slope 抠像参数说明）

**React Native 移植：** 见 [RN-实现指南.md](./RN-实现指南.md)（Expo + Skia + R3F Native 路线、Shader 对照、MVP 步骤）

## 视频

- **默认内置** `public/greenscreen.mp4` — [Mixkit](https://mixkit.co/free-stock-video/donut-with-nut-rotating-on-a-pastel-green-background-44090/) 旋转甜甜圈 · 浅绿幕 · 720p H.264
- Key Color 默认 `#7C9170`（采样自视频背景，非纯绿）
- 替换素材：覆盖 `public/greenscreen.mp4` 并调整右侧 Key Color
- 程序生成占位（纯绿 #00FF00 人形）：

```bash
pip install opencv-python-headless imageio imageio-ffmpeg
python scripts/generate-greenscreen.py
```

## 结构

```
src/main.ts                      ← 3D 场景、运镜、视频 Plane
src/shaders/chromaKeyShader.ts   ← 抠像 GLSL（YCbCr 色度 + 去绿）
src/controlsPanel.ts             ← 右侧阈值 / Key Color 面板
RN-实现指南.md                   ← React Native 移植说明（换电脑必读）
public/tutorial.html             ← Threshold / Slope 图解教程
```
