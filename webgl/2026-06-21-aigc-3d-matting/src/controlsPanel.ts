import type { ChromaUniforms } from './shaders/chromaKeyShader';

export interface MattingConfig {
  threshold: number;
  slope: number;
  keyColorHex: number;
  panAmplitude: number;
  panDurationSec: number;
}

export const mattingConfig: MattingConfig = {
  threshold: 0.07,
  slope: 0.035,
  keyColorHex: 0x7f835e,
  panAmplitude: 2.8,
  panDurationSec: 90,
};

interface SliderSpec {
  key: keyof MattingConfig;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
}

const SLIDERS: SliderSpec[] = [
  {
    key: 'threshold',
    label: '抠像阈值 Threshold',
    hint: 'YCbCr 色度距离阈值。越小抠得越狠（可试 0.04~0.10）。过大易留绿幕。',
    min: 0.02,
    max: 0.2,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'slope',
    label: '边缘斜率 Slope',
    hint: '色度阈值两侧的软过渡。浅绿幕建议 0.03~0.05。',
    min: 0.01,
    max: 0.12,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'panAmplitude',
    label: '摇镜幅度',
    hint: '相机水平 Pan 的左右幅度（世界单位）。越大透视变化越明显。',
    min: 0.5,
    max: 6,
    step: 0.1,
    format: (v) => v.toFixed(1),
  },
  {
    key: 'panDurationSec',
    label: '摇镜周期（秒）',
    hint: '从左到右再回来一趟的时间。越大越慢。',
    min: 20,
    max: 180,
    step: 5,
    format: (v) => `${Math.round(v)}s`,
  },
];

export function initControlsPanel(
  mountEl: HTMLElement,
  chromaUniforms: ChromaUniforms,
  onLayoutChange: () => void,
  onResampleKeyColor: () => void,
): void {
  const panel = document.createElement('aside');
  panel.className = 'controls-panel';
  panel.innerHTML = `
    <button type="button" class="controls-panel__toggle" aria-expanded="true">
      <span class="controls-panel__toggle-icon">◀</span>
      <span class="controls-panel__toggle-text">抠像参数</span>
    </button>
    <div class="controls-panel__body">
      <div class="controls-panel__intro">
        <p><strong>绿幕抠像</strong>：YCbCr 色度距离 + 自动采样 Key Color，适配浅绿/渐变幕。</p>
        <p><strong>3D 调配</strong>：抠出主体贴在 Plane 上，与 Box 道具同处真实 3D 空间，Pan 运镜展示透视。</p>
      </div>
      <div class="controls-panel__groups"></div>
      <div class="controls-panel__row">
        <div class="controls-panel__row-head">
          <label for="ctrl-keycolor">Key Color（绿幕色）</label>
        </div>
        <input type="color" id="ctrl-keycolor" value="#7f835e" />
        <p class="controls-panel__hint">加载视频后自动从四角采样。不准时可手动吸管取背景色。</p>
      </div>
      <button type="button" class="controls-panel__resample">重新采样 Key Color</button>
      <button type="button" class="controls-panel__reset">恢复默认</button>
    </div>
  `;
  mountEl.appendChild(panel);

  const groupsEl = panel.querySelector('.controls-panel__groups')!;
  const colorInput = panel.querySelector('#ctrl-keycolor') as HTMLInputElement;
  const resetBtn = panel.querySelector('.controls-panel__reset')!;
  const resampleBtn = panel.querySelector('.controls-panel__resample')!;
  const toggleBtn = panel.querySelector('.controls-panel__toggle')!;

  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('controls-panel--collapsed');
    onLayoutChange();
  });

  const applyToShader = () => {
    chromaUniforms.uThreshold.value = mattingConfig.threshold;
    chromaUniforms.uSlope.value = mattingConfig.slope;
    chromaUniforms.uKeyColor.value.setHex(mattingConfig.keyColorHex);
  };

  for (const spec of SLIDERS) {
    const section = document.createElement('div');
    section.className = 'controls-panel__group';
    const val = mattingConfig[spec.key] as number;
    section.innerHTML = `
      <h3>${spec.label}</h3>
      <div class="controls-panel__row">
        <div class="controls-panel__row-head">
          <label for="ctrl-${spec.key}">${spec.label}</label>
          <span class="controls-panel__value" id="val-${spec.key}">${spec.format?.(val) ?? val}</span>
        </div>
        <input type="range" id="ctrl-${spec.key}" min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${val}" />
        <p class="controls-panel__hint">${spec.hint}</p>
      </div>
    `;
    groupsEl.appendChild(section);

    const input = section.querySelector('input') as HTMLInputElement;
    const valueEl = section.querySelector('.controls-panel__value') as HTMLSpanElement;
    input.addEventListener('input', () => {
      const num = parseFloat(input.value);
      (mattingConfig[spec.key] as number) = num;
      valueEl.textContent = spec.format?.(num) ?? String(num);
      applyToShader();
    });
  }

  colorInput.addEventListener('input', () => {
    mattingConfig.keyColorHex = parseInt(colorInput.value.slice(1), 16);
    applyToShader();
  });

  resampleBtn.addEventListener('click', () => {
    onResampleKeyColor();
    syncColorInput(colorInput);
    applyToShader();
  });

  resetBtn.addEventListener('click', () => {
    Object.assign(mattingConfig, {
      threshold: 0.07,
      slope: 0.035,
      keyColorHex: chromaUniforms.uKeyColor.value.getHex(),
      panAmplitude: 2.8,
      panDurationSec: 90,
    });
    syncColorInput(colorInput);
    for (const spec of SLIDERS) {
      const input = panel.querySelector(`#ctrl-${spec.key}`) as HTMLInputElement;
      const num = mattingConfig[spec.key] as number;
      input.value = String(num);
      (panel.querySelector(`#val-${spec.key}`) as HTMLSpanElement).textContent =
        spec.format?.(num) ?? String(num);
    }
    applyToShader();
  });

  syncColorInput(colorInput);
  applyToShader();
}

function syncColorInput(colorInput: HTMLInputElement) {
  colorInput.value = `#${mattingConfig.keyColorHex.toString(16).padStart(6, '0')}`;
}
