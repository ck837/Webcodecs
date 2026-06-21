# dj — 端侧 AI 多媒体工程实验场

这个仓库不再只是零散 Demo 集合，而是围绕一条主线收束：

> 研究浏览器如何承接 AI 生成的多媒体资产：从视频解码、图像处理，到 3D Gaussian Splatting 渲染、工作流编排和端侧导出。

## 主线方向

| 方向 | 关注点 | 代表主题 |
|------|--------|----------|
| WebCodecs / WebGPU / 实时媒体管线 | 浏览器视频解码、帧处理、GPU 渲染、录制导出 | [webcodecs/](./webcodecs/) |
| 3D Gaussian Splatting / Web 端神经渲染 | 3DGS 模型加载、格式桥接、相机动画、商品 3D 展示 | [gaussian-splat/](./gaussian-splat/) |
| AI 多媒体 Workflow / 可视化编排 | 上传、抠图、生成、质量评估、资产导出的流程大脑 | [langgraph/](./langgraph/) + i23DGS |

## 旗舰项目

**i23DGS：商品图到 Web 3DGS 展示与导出工作台**

i23DGS 是三条主线的交汇点：

1. **媒体管线**：处理上传图片、透明 PNG、Canvas 渲染和 WebM 录制。
2. **神经渲染**：加载 `.splat` / `.ksplat` / `.ply`，用 Three.js 展示 3DGS 资产。
3. **AI Workflow**：用 job 状态机串起上传、抠图、生成 Provider 和结果资产。

入口：[gaussian-splat/2026-06-14-i23dgs-pipeline/](./gaussian-splat/2026-06-14-i23dgs-pipeline/)

项目讲解：[slides.html](./gaussian-splat/2026-06-14-i23dgs-pipeline/slides.html)

```bash
cd gaussian-splat/2026-06-14-i23dgs-pipeline
npm install
npm run mock:splat
npm run dev
```

## 目录结构

```
dj/
├── AGENTS.md              ← AI 协作规则（目录约定、命名、提交规范）
├── README.md              ← 本文件
│
├── webcodecs/             ← 主线：浏览器实时媒体管线
│   ├── 总览.md
│   └── 2025-05-31-*/
│
├── gaussian-splat/        ← 主线：3DGS 与 Web 端神经渲染
│   ├── 总览.md
│   └── 2026-*/
│
├── langgraph/             ← 主线：AI Workflow / 可视化编排
│   ├── 总览.md
│   └── 2026-06-01-*/
│
├── webgl/                 ← 主线：WebGL / GLSL Shader 学习
│   ├── 总览.md
│   └── 2026-06-21-*/
│
├── diffusion/             ← 支线：扩散模型概念讲解
│   ├── 总览.md
│   └── 2025-05-31-*/
│
├── onnx/                  ← 支线：ONNX Runtime Web 浏览器推理
│   ├── 总览.md
│   └── 2026-*/
│
└── drone-gyro/            ← 归档：早期传感器 / WebSocket 探索
    ├── 总览.md
    └── 2025-05-31-*/
```

**命名规则**：`主题/YYYY-MM-DD-demo名/index.html` — 详见 [AGENTS.md](./AGENTS.md)。

## Demo 索引

| 主题 | 定位 | 总览 | 推荐入口 |
|------|------|------|----------|
| Gaussian Splat | 旗舰方向：Web 3DGS 与神经渲染资产 | [gaussian-splat/总览.md](./gaussian-splat/总览.md) | [i23DGS](./gaussian-splat/2026-06-14-i23dgs-pipeline/) |
| WebCodecs | 浏览器媒体底层与实时处理 | [webcodecs/总览.md](./webcodecs/总览.md) | [decode-canvas](./webcodecs/2025-05-31-decode-canvas/) |
| LangGraph | AI 多媒体流程编排的可视化基础 | [langgraph/总览.md](./langgraph/总览.md) | `python langgraph/2026-06-01-visual-agent-topology/visual_agent.py --serve` |
| WebGL | GLSL Shader + R3F 学习沙盒 | [webgl/总览.md](./webgl/总览.md) | `cd webgl/2026-06-21-shader-learning-sandbox && npm run dev` |
| Diffusion | 概念讲解支线，服务 AI 视觉理解 | [diffusion/总览.md](./diffusion/总览.md) | [diffusion-visual](./diffusion/2025-05-31-diffusion-visual/) |
| ONNX | 浏览器端 ONNX Runtime Web 推理入门 | [onnx/总览.md](./onnx/总览.md) | [mobilenet-classifier](./onnx/2026-06-15-mobilenet-classifier/) |
| Drone Gyro | 早期归档探索 | [drone-gyro/总览.md](./drone-gyro/总览.md) | `node drone-gyro/2025-05-31-ws-broadcast/server.js` |

## 快速开始

静态 Demo：

```bash
python -m http.server 8080
```

i23DGS React / Three 工程：

```bash
cd gaussian-splat/2026-06-14-i23dgs-pipeline
npm install
npm run mock:splat
npm run dev
```

## 要求

- Chrome / Edge 94+（WebCodecs Demo）
- Node.js 18+（WebSocket Demo，无 npm 依赖）
- Node.js 20+（i23DGS React / Three 工程）
