# 模型文件

本目录需放置 ONNX 模型（不纳入 Git，体积较大）。

## 下载 MobileNet v2（推荐）

PowerShell：

```powershell
Invoke-WebRequest -Uri "https://github.com/onnx/models/raw/main/validated/vision/classification/mobilenet/model/mobilenetv2-7.onnx" -OutFile "mobilenetv2-7.onnx"
```

或 curl：

```bash
curl -L -o mobilenetv2-7.onnx "https://github.com/onnx/models/raw/main/validated/vision/classification/mobilenet/model/mobilenetv2-7.onnx"
```

## 备选：SqueezeNet 1.1

```bash
curl -L -o squeezenet1.1-7.onnx "https://github.com/onnx/models/raw/main/validated/vision/classification/squeezenet/model/squeezenet1.1-7.onnx"
```

若使用 SqueezeNet，请在 `index.html` 中将 `MODEL_URL` 改为 `./models/squeezenet1.1-7.onnx`（输入预处理相同）。

## 来源

- [ONNX Model Zoo — Image Classification](https://github.com/onnx/models/tree/main/validated/vision/classification)
