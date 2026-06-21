# WebGL Shader Learning Sandbox

Vite + React + React Three Fiber 最小 Shader 学习沙盒。

## 运行

```bash
npm install
npm run dev
```

打开 http://127.0.0.1:5173

**教程：** [tutorial.html](http://127.0.0.1:5173/tutorial.html)（配合 Demo 阅读）

## 文件地图

| 文件 | 作用 |
|------|------|
| `src/shaders/vertexShader.ts` | 顶点 GLSL（MVP 变换 + 输出 Varying） |
| `src/shaders/fragmentShader.ts` | 片元 GLSL（**从这里改视觉效果**） |
| `src/components/ShaderSphere.tsx` | `useFrame` 更新 `uTime` / `uMousePosition` |
| `src/App.tsx` | Canvas + OrbitControls + 鼠标 UV |

## 学习实验

1. `fragmentShader.ts` 里把 `finalColor` 换成 `vec4(vUv, 0.0, 1.0)` — 看 UV 彩虹图
2. 改 `mouseGlow` 分母 — 热点大小变化
3. 在 vertex shader 里改 `gl_Position` — 理解顶点阶段

## 栈

- Vite 5
- React 18
- @react-three/fiber 8
- @react-three/drei（OrbitControls）
- three.js
