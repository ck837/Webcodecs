# WebCodecs 视频解码 Demo

浏览器端 WebCodecs 硬解码示例，支持 MP4 / M3U8 / TS 输入，解码后渲染到 Canvas。

## 文件

| 文件 | 说明 |
|------|------|
| `webcodecs-decode-canvas.html` | 基础 Demo：上传 MP4 → 硬解码 → Canvas |
| `webcodecs-pipeline-visual.html` | 9 步管线可视化，含实时数据与格式自动切换 |
| `webcodecs-demux-decode-slides.html` | 解封装 → 解码 概念讲解（幻灯片） |

## 运行

WebCodecs 需要 Secure Context，请用本地 HTTP 服务打开（不要用 `file://`）：

```bash
python -m http.server 8080
```

浏览器访问 `http://localhost:8080/webcodecs-decode-canvas.html`

## 依赖

通过 CDN 加载，无需 npm：

- [mp4box.js](https://github.com/gpac/mp4box.js) — MP4/fMP4 解封装
- [mux.js](https://github.com/videojs/mux.js) — TS → fMP4 transmux（可视化 Demo）

## 要求

- Chrome / Edge 94+（支持 WebCodecs）
- 视频编码：H.264（avc1）
