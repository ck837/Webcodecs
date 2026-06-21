# React Native 实现指南

> 本文档对应 Web Demo：`webgl/2026-06-21-aigc-3d-matting/`  
> 在其他电脑用 **同一套抠像思路** 做 RN 版时，先看本文，再对照 Web 源码。

---

## 1. Web 版在做什么（你要复刻的能力）

```
MP4 绿幕视频
  → 逐像素抠像（YCbCr 色度距离 + Threshold/Slope）
  → 透明主体贴到 3D 平面
  → 与 Box / 网格同处 3D 空间
  → 相机水平 Pan
```

**不是 AI 抠图**，是传统 **GPU 色度键（Chroma Key）**。

Web 核心文件：

| 文件 | 职责 |
|------|------|
| `src/shaders/chromaKeyShader.ts` | 抠像 GLSL + 自动采样 Key Color |
| `src/main.ts` | Three.js 场景、VideoTexture、Plane、运镜 |
| `src/controlsPanel.ts` | Threshold / Slope / Key Color 面板 |
| `public/greenscreen.mp4` | 测试素材（Mixkit 浅绿幕甜甜圈） |
| `public/tutorial.html` | Threshold / Slope 通俗教程 |

---

## 2. Web 技术栈 vs RN 怎么换

| Web（当前 Demo） | React Native 对应 | 说明 |
|------------------|-------------------|------|
| Vite + TypeScript | **Expo + TypeScript** | 推荐 Expo，省原生配置 |
| Three.js | `three` + **`@react-three/fiber/native`** + **`expo-gl`** | 3D 场景 / 运镜 |
| `HTMLVideoElement` | **`expo-av`** 或 **`react-native-video`** | 播 MP4 |
| `THREE.VideoTexture` | **无直接等价** ⚠️ | RN 最大差异点，见下文 |
| 自定义 GLSL | Three `ShaderMaterial` **或** Skia `RuntimeShader` | 算法可复用 |
| Canvas 读像素采样 Key Color | Skia `makeImageSnapshot` / 首帧截图 | 逻辑可复用 |
| HTML 参数面板 | RN `View` + `@react-native-community/slider` | — |

**结论：** 3D 和抠像公式都能搬；**视频帧 → GPU 纹理** 在 RN 要多做一层。

---

## 3. 三条实现路线（按推荐顺序）

### 路线 A · WebView 嵌入（最快验证，1~2 天）

```
RN App
 └── WebView → 部署/本地启动 Web Demo（本仓库 Vite 页面）
```

| 优点 | 缺点 |
|------|------|
| 几乎零改 Shader | 不是原生 RN 体验 |
| 效果与 Web 100% 一致 | 与 RN 导航/原生 UI 融合弱 |

适合：先给产品/设计看效果，或内嵌 H5。

```tsx
// 伪代码
<WebView source={{ uri: 'https://你的服务器/5175/' }} />
```

本地调试：电脑跑 `npm run dev`，手机同一局域网访问 `http://<电脑IP>:5175/`。

---

### 路线 B · Expo + R3F Native + Skia（推荐正式 RN 版）

**分工：**

- **Skia**：负责「视频 + 绿幕抠像」→ 输出带 alpha 的图像
- **R3F Native**：负责 3D 场景（Grid、Box、相机 Pan）
- **合成**：Skia 抠好的主体作为 **纹理** 贴到 R3F 的 `Plane` 上

```
┌─────────────────────────────────────┐
│  expo-av / react-native-video       │
│         ↓ 视频帧                     │
│  @shopify/react-native-skia         │
│    RuntimeShader（YCbCr 抠像）       │
│         ↓ 透明 PNG / Texture         │
│  @react-three/fiber/native          │
│    Plane + Box + Pan 相机            │
│         ↓                            │
│  expo-gl 渲染到屏幕                  │
└─────────────────────────────────────┘
```

| 优点 | 缺点 |
|------|------|
| 真 RN、可上架 | 架构比 Web 多一层 |
| Shader 思路与 Web 一致 | 需学 Skia RuntimeShader 语法 |

**预估工作量：** MVP 约 1~2 周（熟悉 Expo 的前提下）。

---

### 路线 C · 纯 R3F + 原生出帧（最难，不推荐首发）

自己写原生模块把 `react-native-video` 的帧喂给 `THREE.Texture`。

工作量大、机型差异多，除非有原生同学，否则 **不建议** 作为第一版。

---

## 4. 推荐依赖（路线 B · Expo）

```bash
npx create-expo-app aigc-3d-matting-rn -t expo-template-blank-typescript
cd aigc-3d-matting-rn

npx expo install expo-gl expo-av
npm install three @react-three/fiber @react-native-community/slider
npx expo install @shopify/react-native-skia
```

| 包 | 用途 |
|----|------|
| `expo-gl` | RN 上的 WebGL 上下文 |
| `@react-three/fiber` | Three.js 声明式封装（用 `/native` 入口） |
| `three` | 3D 引擎（与 Web 同版本系即可） |
| `@shopify/react-native-skia` | 2D GPU 抠像 Shader |
| `expo-av` | 播放 `assets/greenscreen.mp4` |
| `@react-native-community/slider` | Threshold / Slope 滑块 |

> Bare RN（无 Expo）也可行，但需自行链接 `react-native-skia` 与 GL 上下文，配置更重。

---

## 5. 抠像算法（从 Web 原样搬的核心）

Web 版已改为 **YCbCr 色度距离**（适配浅绿 / 渐变绿幕，如 Mixkit 甜甜圈）。

### 5.1 为什么不用纯 RGB 距离？

浅绿幕有阴影和渐变，**亮度变了但颜色种类仍是绿**。  
RGB 距离会把暗部绿幕当成「不像 Key Color」→ **抠不干净**。  
**色度 (Cb, Cr) 忽略亮度**，阴影区也能稳定抠掉。

### 5.2 默认参数（与 Web Demo 一致）

| 参数 | 默认值 | 含义 |
|------|--------|------|
| `uThreshold` | `0.07` | 色度距离阈值，越小抠越狠（范围约 0.04~0.12） |
| `uSlope` | `0.035` | 边缘软过渡宽度（约 0.03~0.05） |
| `uKeyColor` | 自动采样 | 从视频四角取平均 RGB，不要写死 `#00FF00` |

⚠️ **注意：** Threshold 刻度是 **YCbCr 色度空间**，不是旧版 RGB 的 0.2~0.8。  
教程 `public/tutorial.html` 部分图示仍按 RGB 讲解，调参以 **本文 + Web 面板默认值** 为准。

### 5.3 GLSL 核心（Web 版，Skia 移植参考）

摘自 `src/shaders/chromaKeyShader.ts`：

```glsl
// BT.601：RGB → 色度 (Cb, Cr)
vec2 rgbToCbCr(vec3 rgb) {
  return vec2(
    dot(rgb, vec3(-0.169, -0.331, 0.500)) + 0.5,
    dot(rgb, vec3(0.500, -0.419, -0.081)) + 0.5
  );
}

void main() {
  vec3 color = /* 采样视频 RGB，0~1 */;
  vec2 cbCr = rgbToCbCr(color);
  vec2 keyCbCr = rgbToCbCr(uKeyColor);

  float distChroma = distance(cbCr, keyCbCr);
  float alpha = smoothstep(uThreshold - uSlope, uThreshold + uSlope, distChroma);

  // 绿溢抑制
  float spill = max(0.0, color.g - max(color.r, color.b));
  color.g -= spill * (1.0 - alpha) * 0.9;

  // 输出 premultiplied 或 straight alpha 视 Skia/Three 混合模式而定
}
```

### 5.4 Skia RuntimeShader 骨架（RN）

Skia 语法与 GLSL 接近但不同，需按 [Skia Shading Language](https://skia.org/docs/user/sksl/) 改写。逻辑保持一致即可：

```tsx
// 概念代码 — 需按 Skia 当前 API 调整
import { Skia } from '@shopify/react-native-skia';

const chromaKeyEffect = Skia.RuntimeEffect.Make(`
  uniform shader image;
  uniform vec3 keyColor;
  uniform float threshold;
  uniform float slope;

  vec2 rgbToCbCr(vec3 rgb) {
    return vec2(
      dot(rgb, vec3(-0.169, -0.331, 0.500)) + 0.5,
      dot(rgb, vec3(0.500, -0.419, -0.081)) + 0.5
    );
  }

  half4 main(vec2 coord) {
    half4 tex = image.eval(coord);
    vec3 color = tex.rgb;

    float dist = distance(rgbToCbCr(color), rgbToCbCr(keyColor));
    float alpha = smoothstep(threshold - slope, threshold + slope, dist);

    float spill = max(0.0, color.g - max(color.r, color.b));
    color.g -= spill * (1.0 - alpha) * 0.9;

    return half4(color * alpha, alpha);
  }
`);
```

视频输入：Skia `Video` / 图像 shader 管线 — 以 Skia 官方 **Video + RuntimeShader** 示例为准（版本更新较快）。

### 5.5 Key Color 自动采样（RN 思路）

Web 版：`sampleKeyColorFromVideo()` 用 Canvas 读四角像素。

RN 等价做法：

1. `expo-av` 视频 **首帧** `pause` 后截图；或
2. Skia 对视频第一帧 `makeImageSnapshot`；或
3. 手动 `@shopify/react-native-skia` 读像素（性能注意）

采样点（与 Web 一致，避开画面中心主体）：

```
(4%, 4%)  (96%, 4%)
(4%, 96%)  (96%, 96%)
(50%, 4%)  (4%, 50%)  (96%, 50%)
```

对 RGB 求平均 → `keyColor`。

---

## 6. 3D 场景（R3F Native 对照 Web）

Web `src/main.ts` 中 3D 部分可直接映射：

| Web | R3F Native |
|-----|------------|
| `GridHelper(16,16)` | `<gridHelper args={[16,16]} />` |
| `AxesHelper(3)` | `<axesHelper args={[3]} />` |
| 4 个 `BoxGeometry` + `MeshStandardMaterial` | `<mesh><boxGeometry /><meshStandardMaterial /></mesh>` |
| `PlaneGeometry` + 抠像材质 | `<mesh><planeGeometry /><shaderMaterial /></mesh>` |
| `camera.position.x = sin(t) * amp` | `useFrame` 里改 `camera.position.x` |
| `lookAt(0, 1, 0)` | `camera.lookAt(0, 1, 0)` |

### R3F Native 最小入口

```tsx
import { Canvas } from '@react-three/fiber/native';
import { GLView } from 'expo-gl'; // 通常由 r3f native 内部处理

export default function MattingScreen() {
  return (
    <Canvas style={{ flex: 1 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 8, 5]} intensity={1.1} />
      {/* Grid / Box / 带抠像纹理的 Plane */}
    </Canvas>
  );
}
```

### 视频纹理接到 Plane 的两种做法

**做法 1（推荐）：** Skia 每帧输出 → 转 `THREE.Texture` / `CanvasTexture` 更新 `material.map`  
**做法 2：** 研究 `expo-three` 社区方案（版本杂，维护需自行验证）

---

## 7. 建议 RN 工程目录

```
aigc-3d-matting-rn/
├── App.tsx
├── assets/
│   └── greenscreen.mp4          ← 从 Web Demo public/ 复制
├── src/
│   ├── shaders/
│   │   ├── chromaKey.sksl.ts    ← Skia RuntimeEffect 字符串
│   │   └── chromaKeyThree.ts    ← 若走 Three ShaderMaterial，从 Web 复制 GLSL
│   ├── components/
│   │   ├── MattingCanvas.tsx    ← Skia 抠像层
│   │   ├── Scene3D.tsx          ← R3F 场景
│   │   └── ControlsPanel.tsx    ← Threshold / Slope / Key Color
│   ├── hooks/
│   │   ├── useKeyColorSample.ts ← 四角采样
│   │   └── useMattingUniforms.ts
│   └── constants/
│       └── mattingDefaults.ts   ← threshold: 0.07, slope: 0.035
└── RN-实现指南.md               ← 本文档副本（可选）
```

---

## 8. MVP 实施步骤（路线 B checklist）

- [ ] **Step 1** 新建 Expo 项目，复制 `greenscreen.mp4` 到 `assets/`
- [ ] **Step 2** Skia：静态图片 + RuntimeShader 抠像调通（先不用视频）
- [ ] **Step 3** 接上 `expo-av` 视频，Shader 输入改为视频帧
- [ ] **Step 4** 实现四角 Key Color 自动采样 + 滑块调 Threshold/Slope
- [ ] **Step 5** R3F：只放 Grid + Box + 相机 Pan（无视频）
- [ ] **Step 6** Skia 抠像结果 → 纹理贴到 R3F Plane，完成 3D 合成
- [ ] **Step 7** 参数面板、性能与真机测试（iOS + Android）

---

## 9. 调参速查（真机上也适用）

| 现象 | 操作 |
|------|------|
| 背景绿去不干净 | ↓ Threshold（如 0.07 → 0.05），或重新采样 Key Color |
| 主体边缘被啃掉 | ↑ Threshold |
| 边缘锯齿 | ↑ Slope |
| 边缘发虚 / 蒙雾 | ↓ Slope |
| 一圈绿边 | 检查 despill 是否启用；略 ↓ Threshold |

---

## 10. 没有用的技术（避免走弯路）

| 不需要 | 原因 |
|--------|------|
| AI 分割模型 | 本 Demo 是色度键，不是 MODNet / SAM |
| FFmpeg（RN 内） | 浏览器外 RN 播 MP4 用 expo-av 即可 |
| `HTMLVideoElement` | RN 不存在 |
| 旧版 `greenExcess` 纯绿算法 | 浅绿幕效果差，已废弃 |
| RGB 距离 Threshold 0.2~0.8 | 刻度已换为 YCbCr 色度空间 |

---

## 11. 从本仓库带走的文件清单

换电脑开发 RN 时，建议拷贝或 clone 整个 `dj` 仓库，至少保留：

```
webgl/2026-06-21-aigc-3d-matting/
├── RN-实现指南.md                 ← 本文
├── public/greenscreen.mp4
├── public/tutorial.html
├── src/shaders/chromaKeyShader.ts ← GLSL 与采样逻辑
├── src/main.ts                    ← 3D 布局与运镜参数
├── src/controlsPanel.ts           ← 默认 threshold / slope
└── README.md
```

运镜默认（与 Web 一致）：

```ts
panAmplitude: 2.8
panDurationSec: 90
camera: position (0, 1.6, 6), lookAt (0, 1, 0)
subjectPlaneWidth: 2.4 world units
```

---

## 12. 参考链接

- [Expo GL](https://docs.expo.dev/versions/latest/sdk/gl/)
- [React Three Fiber Native](https://docs.pmnd.rs/react-three-fiber/getting-started/installation#react-native)
- [React Native Skia](https://shopify.github.io/react-native-skia/)
- [Skia Shading Language](https://skia.org/docs/user/sksl/)

---

## 13. 与 Web Demo 的运行命令（对照）

```bash
# Web — 本机验证抠像效果
cd webgl/2026-06-21-aigc-3d-matting
npm install && npm run dev
# http://127.0.0.1:5175

# RN — 新建项目后
npx expo start
```

换电脑时：**先跑通 Web 确认效果 → 再按本文路线 B 拆 Skia + R3F**。
