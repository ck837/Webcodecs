# i23DGS: Image to 3D Gaussian Splatting

一个面向商品图的自动化流水线与交互展示 Demo：

1. Node.js TypeScript API 接收商品图片上传。
2. Python `rembg` 脚本输出透明 PNG。
3. 标准化 3DGS Provider 接口把透明 PNG 交给本地 Mock 或远端 AI 节点。
4. React + Three.js + GaussianSplats3D 加载 `.splat`，提供 OrbitControls、相机关键帧和 WebM 录制。

## 运行

```bash
npm install
npm run mock:splat
npm run dev
```

前端默认运行在 `http://127.0.0.1:5173`，API 默认运行在 `http://127.0.0.1:8787`。

## Python 抠图依赖

```bash
pip install rembg pillow
```

也可以通过环境变量指定 Python：

```bash
$env:I23DGS_PYTHON="python"
```

## 远端 3DGS 节点

当前本地 Provider 会调用 `scripts/image_to_splat.py`，从 `rembg` 输出的透明 PNG 采样颜色和 alpha，生成图像驱动的 2.5D `.splat` baseline。它是真实文件构建流程，但不是神经网络单图 3DGS 重建，不代表工业级 Image-to-3D 质量。

## 真实 3DGS 样例

`public/real-splats/official/` 存放 GaussianSplats3D 官方 demo 数据包解出的真实 `.ksplat` 场景。前端样例库默认挂载 5 个文件：

- `bonsai/bonsai_trimmed.ksplat`
- `bonsai/bonsai.ksplat`
- `truck/truck.ksplat`
- `stump/stump.ksplat`
- `garden/garden.ksplat`

这些是公开 demo scene，可用于验证真实高斯模型加载、交互和动画导出。`*_high.ksplat` 文件也保留在目录中，可通过“加载真实 .splat / .ply / .ksplat”手动选择。

工业级效果需要接入真实 Provider，例如：

- 多视图扩散或单图多视角生成。
- TripoSR/LGM 类模型产出 mesh 或 gaussian 表示。
- 服务端细化：尺度归一、法线/深度估计、透明背景一致性、3DGS 优化迭代。
- 前端直接加载真实 `.splat`、`.ksplat` 或 `.ply` 文件。

接真实单图转 3DGS 服务时，设置：

```bash
$env:I23DGS_AI_ENDPOINT="https://your-provider.example.com/i23dgs"
$env:I23DGS_AI_KEY="..."
```

然后把前端或后端请求里的 provider 从 `mock-local` 切到 `remote-api`。远端接口预期接收 `image/png` 请求体，返回 `.splat` 或 `.ply` 文件字节。

## 关键文件

- `src/server/routes/jobs.ts`: 上传、状态查询、生成触发、静态资产读取。
- `src/server/services/matting-service.ts`: Node 调 Python `rembg`。
- `src/server/services/gaussian-service.ts`: Mock/Remote 两种 3DGS Provider。
- `src/client/gaussian/GaussianStage.ts`: Three.js 渲染器、OrbitControls、GaussianSplats3D Viewer。
- `src/client/animation/camera-paths.ts`: 相机关键帧与 FOV 插值。
- `src/client/recording/media-recorder.ts`: Canvas MediaRecorder 导出 WebM。
