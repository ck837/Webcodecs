/**
 * ImageNet 标准预处理（与 PyTorch torchvision 验证集一致）
 * Resize 短边 256 → CenterCrop 224 → RGB → (x-mean)/std → NCHW
 */
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];
const INPUT_SIZE = 224;
const RESIZE_SHORT = 256;

let _scratch;
function scratchCanvas(w, h) {
  if (!_scratch) _scratch = document.createElement('canvas');
  _scratch.width = w;
  _scratch.height = h;
  return _scratch;
}

/** 短边缩放到 target，等比 */
function scaledSize(img, shortSide) {
  const scale = shortSide / Math.min(img.width, img.height);
  return {
    w: Math.round(img.width * scale),
    h: Math.round(img.height * scale),
  };
}

/**
 * 在 ctx 上绘制送入模型的 224×224（标准 center crop）
 * 返回 { imageData } 供调试
 */
function drawImageNetInput(ctx, img, size = INPUT_SIZE, resizeShort = RESIZE_SHORT) {
  const { w, h } = scaledSize(img, resizeShort);
  const tmp = scratchCanvas(w, h);
  tmp.getContext('2d').drawImage(img, 0, 0, w, h);

  const sx = Math.max(0, Math.floor((w - size) / 2));
  const sy = Math.max(0, Math.floor((h - size) / 2));

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(tmp, sx, sy, size, size, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

/** ImageData → ort.Tensor [1,3,H,W] NCHW float32 */
function imageDataToTensor(imageData, size = INPUT_SIZE) {
  const plane = size * size;
  const buf = new Float32Array(3 * plane);
  const { data } = imageData;
  let min = Infinity, max = -Infinity;

  for (let i = 0; i < plane; i++) {
    const p = i * 4;
    const r = data[p] / 255;
    const g = data[p + 1] / 255;
    const b = data[p + 2] / 255;
    buf[i] = (r - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    buf[plane + i] = (g - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    buf[2 * plane + i] = (b - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
    for (const v of [buf[i], buf[plane + i], buf[2 * plane + i]]) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }

  return {
    tensor: new ort.Tensor('float32', buf, [1, 3, size, size]),
    stats: { min, max },
  };
}

/** 一步完成：绘制 + Tensor */
function preprocessImageNet(img, ctx) {
  const imageData = drawImageNetInput(ctx, img);
  return imageDataToTensor(imageData);
}

/** 若模型输出为 logits，转为概率 */
function toProbabilities(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  if (sum > 0.98 && sum < 1.02) return data;

  let max = -Infinity;
  for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i];

  const out = new Float32Array(data.length);
  let s = 0;
  for (let i = 0; i < data.length; i++) {
    out[i] = Math.exp(data[i] - max);
    s += out[i];
  }
  for (let i = 0; i < out.length; i++) out[i] /= s;
  return out;
}

function topK(probs, k = 5) {
  return Array.from(probs, (score, i) => ({ i, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
