# 下载 ImageNet 分类模型 + 标签
# ResNet18（推荐，更准）+ MobileNet v2（轻量）
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$models = Join-Path $root 'models'
New-Item -ItemType Directory -Force -Path $models | Out-Null

$assets = @(
  @{
    Url  = 'https://github.com/onnx/models/raw/main/validated/vision/classification/resnet/model/resnet18-v2-7.onnx'
    Path = Join-Path $models 'resnet18-v2-7.onnx'
    Name = 'resnet18-v2-7.onnx (~45 MB, 推荐)'
  },
  @{
    Url  = 'https://github.com/onnx/models/raw/main/validated/vision/classification/mobilenet/model/mobilenetv2-7.onnx'
    Path = Join-Path $models 'mobilenetv2-7.onnx'
    Name = 'mobilenetv2-7.onnx (~14 MB, 轻量)'
  }
)

$labelsUrl = 'https://cdn.jsdelivr.net/gh/pytorch/hub@master/imagenet_classes.txt'
$labelsPath = Join-Path $models 'imagenet_classes.txt'
$sampleDir = Join-Path $root 'sample'
New-Item -ItemType Directory -Force -Path $sampleDir | Out-Null
$dogSampleUrl = 'https://raw.githubusercontent.com/pytorch/hub/master/images/dog.jpg'
$dogSamplePath = Join-Path $sampleDir 'dog.jpg'

foreach ($a in $assets) {
  if (-not (Test-Path $a.Path)) {
    Write-Host "Downloading $($a.Name)..."
    Invoke-WebRequest -Uri $a.Url -OutFile $a.Path -UseBasicParsing
  } else {
    Write-Host "Already exists:" $a.Path
  }
}

if (-not (Test-Path $labelsPath)) {
  Write-Host 'Downloading imagenet_classes.txt...'
  Invoke-WebRequest -Uri $labelsUrl -OutFile $labelsPath -UseBasicParsing
} else {
  Write-Host 'Labels already exist:' $labelsPath
}

if (-not (Test-Path $dogSamplePath)) {
  Write-Host 'Downloading sample/dog.jpg (ImageNet 有明确类别)...'
  Invoke-WebRequest -Uri $dogSampleUrl -OutFile $dogSamplePath -UseBasicParsing
} else {
  Write-Host 'Sample dog.jpg already exists'
}

Write-Host 'Done. Run: python -m http.server 8080'
