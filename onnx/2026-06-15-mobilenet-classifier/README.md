# ImageNet 图像分类 · ONNX Runtime Web

开箱即用 Demo：标准 ImageNet 预处理 + **ResNet18（默认，更准）** / MobileNet v2（轻量）。

## 精度说明

- **预处理**：`Resize(短边256) + CenterCrop(224)`，与 PyTorch 验证集一致（旧版 letterbox 黑边会降低准确率）
- **模型**：默认 ResNet18（Top-1 明显高于 MobileNet）；下拉可切回轻量模型

## 运行

```bash
cd onnx/2026-06-15-mobilenet-classifier
powershell -ExecutionPolicy Bypass -File scripts/download.ps1   # 首次下载模型
python -m http.server 8080
```

- Demo：http://127.0.0.1:8080/index.html  
- 实验课：http://127.0.0.1:8080/lab.html

## 目录

```
2026-06-15-mobilenet-classifier/
├── index.html
├── lab.html
├── preprocess.js           # 共享 ImageNet 预处理
├── models/
│   ├── resnet18-v2-7.onnx  # ~45MB 推荐
│   ├── mobilenetv2-7.onnx  # ~14MB 轻量
│   └── imagenet_classes.txt
└── scripts/download.ps1
```
