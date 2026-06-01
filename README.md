# dj — 前端 AI 多媒体实验场

边打游戏边研究的 Demo 集合：WebCodecs 硬解码、扩散模型直觉讲解、无人机陀螺仪 WebSocket 模拟。

## 目录结构

```
dj/
├── claude.md              ← AI 协作规则（目录约定、命名、提交规范）
├── README.md              ← 本文件
│
├── webcodecs/             ← 主题：浏览器 WebCodecs 解码
│   ├── 总览.md
│   └── 2025-05-31-*/
│
├── diffusion/             ← 主题：扩散模型概念讲解
│   ├── 总览.md
│   └── 2025-05-31-*/
│
└── drone-gyro/            ← 主题：陀螺仪 WebSocket 模拟
    ├── 总览.md
    └── 2025-05-31-*/
```

**命名规则**：`主题/YYYY-MM-DD-demo名/index.html` — 详见 [claude.md](./claude.md)。

## 快速开始

```bash
python -m http.server 8080
```

| 主题 | 总览 | 首个 Demo |
|------|------|-----------|
| WebCodecs | [webcodecs/总览.md](./webcodecs/总览.md) | [/webcodecs/2025-05-31-decode-canvas/](./webcodecs/2025-05-31-decode-canvas/) |
| Diffusion | [diffusion/总览.md](./diffusion/总览.md) | [/diffusion/2025-05-31-diffusion-visual/](./diffusion/2025-05-31-diffusion-visual/) |
| Drone Gyro | [drone-gyro/总览.md](./drone-gyro/总览.md) | `node drone-gyro/2025-05-31-ws-broadcast/server.js` |

## 要求

- Chrome / Edge 94+（WebCodecs Demo）
- Node.js 18+（WebSocket Demo，无 npm 依赖）
