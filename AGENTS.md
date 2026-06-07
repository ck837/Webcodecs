# Codex / Cursor 项目规则

本仓库是前端工程师的 **AI + 多媒体实验场**。所有 AI 助手（Codex、Cursor Agent 等）在本项目中协作时，必须遵守以下规则。

---

## 目录约定

```
dj/                          ← 仓库根
├── AGENTS.md                ← 全局 AI 规则（本文件）
├── README.md                ← 仓库总入口
│
├── {主题}/                  ← 最外层 = 主题（webcodecs、diffusion、drone-gyro …）
│   ├── 总览.md              ← 该主题的概念地图、Demo 索引、运行方式
│   └── {YYYY-MM-DD}-{demo名}/   ← 每个 Demo 独立文件夹
│       ├── index.html       ← 浏览器 Demo 入口（惯例命名）
│       └── …                ← 该 Demo 专属资源（server.js、client-demo.html 等）
```

### 命名规则

| 层级 | 格式 | 示例 |
|------|------|------|
| 主题文件夹 | 小写英文 kebab-case | `webcodecs`、`diffusion` |
| Demo 文件夹 | `YYYY-MM-DD-{demo名}` | `2025-05-31-decode-canvas` |
| Demo 入口 | 浏览器 Demo 用 `index.html` | — |

- **日期**：Demo 创建或首次合入主线的日期。
- **demo名**：简短 kebab-case，描述功能而非技术栈堆砌。
- **禁止**在主题根目录直接散落 `.html` / `.js` 文件；一律放进 dated demo 文件夹。

---

## 新建 Demo 流程

1. 确认所属**主题**；无合适主题则新建主题文件夹 + `总览.md`。
2. 创建 `主题/YYYY-MM-DD-demo名/` 文件夹。
3. 实现 Demo，浏览器项目入口命名为 `index.html`。
4. 更新该主题的 `总览.md`（表格追加一行：日期、文件夹、说明、运行命令）。
5. 若为新主题，同步更新根目录 `README.md` 主题列表。

---

## 代码风格

- **最小 diff**：只改与任务相关的文件，不顺手重构无关代码。
- **零公式优先**：概念讲解类 Demo 默认不用数学公式，用物理/视觉比喻。
- **纯原生优先**：除非 Demo 本身需要，否则不引入 npm 依赖；Node 脚本仅用内置模块。
- **自包含**：每个 dated demo 文件夹应能独立运行（CDN 依赖除外）。
- **中文 UI**：面向自己的 Demo 默认中文界面与注释。

---

## 运行约定

- 浏览器 Demo 必须通过 **HTTP 服务** 访问（WebCodecs 等 API 需要 Secure Context）：

  ```bash
  python -m http.server 8080
  ```

- Node 脚本在 demo 文件夹内执行，例如：

  ```bash
  node drone-gyro/2025-05-31-ws-broadcast/server.js
  ```

---

## 主题间交叉链接

- 同一主题内：用相对路径 `../2025-05-31-xxx/`。
- 跨主题：从仓库根写 `/{主题}/2025-05-31-xxx/`。
- 幻灯片 / 总览 md 中维护链接，避免硬编码已废弃的扁平文件名。

---

## Git 提交

- 仅在用户明确要求时 `commit` / `push`。
- 提交信息用英文或中文均可，说明 **why** 而非堆砌文件名。
- 一个主题的大重构可以一个 commit；新 Demo 可单独 commit。

---

## 当前主题一览

| 主题 | 说明 |
|------|------|
| `webcodecs/` | 浏览器 WebCodecs 硬解码、解封装、管线可视化 |
| `diffusion/` | 扩散模型概念讲解（零公式、物理比喻） |
| `langgraph/` | LangGraph Agent 有向图拓扑 + Canvas 可视化 |
| `drone-gyro/` | 无人机陀螺仪 WebSocket 模拟广播 |

详细 Demo 索引见各主题下的 `总览.md`。
