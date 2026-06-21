/** 右侧「电影增强」可调参数 */
export interface EnhanceConfig {
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  grainIntensity: number;
  dollyDurationSec: number;
  dollyEnabled: boolean;
  cameraZStart: number;
  cameraZEnd: number;
  toneMappingExposure: number;
}

export const enhanceConfig: EnhanceConfig = {
  bloomStrength: 1.45,
  bloomRadius: 0.72,
  bloomThreshold: 0.18,
  grainIntensity: 0.18,
  dollyDurationSec: 120,
  dollyEnabled: true,
  cameraZStart: 3.2,
  cameraZEnd: 1.6,
  toneMappingExposure: 1.05,
};

interface SliderSpec {
  key: keyof EnhanceConfig;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
}

const SLIDER_GROUPS: { title: string; desc: string; items: SliderSpec[] }[] = [
  {
    title: '霓虹辉光 Bloom',
    desc: '把画面里「够亮」的区域（灯光、反光）抠出来，模糊后再叠回去 → 霓虹溢光感。只影响右屏。',
    items: [
      {
        key: 'bloomStrength',
        label: '辉光强度',
        hint: '发光有多亮、多抢眼。越大越「赛博朋克溢光」。',
        min: 0,
        max: 3,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'bloomRadius',
        label: '弥散半径',
        hint: '光晕向外扩散多远。越大越柔和、越朦胧。',
        min: 0,
        max: 1.5,
        step: 0.01,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'bloomThreshold',
        label: '亮度阈值',
        hint: '多亮才开始发光。越低 → 更多区域会亮起来；越高 → 只有高光才发光。',
        min: 0,
        max: 1,
        step: 0.01,
        format: (v) => v.toFixed(2),
      },
    ],
  },
  {
    title: '胶片颗粒 Film Grain',
    desc: '在像素上叠加随时间变化的噪点，打破 AI 视频「塑料平滑感」，模拟胶片质感。',
    items: [
      {
        key: 'grainIntensity',
        label: '颗粒强度',
        hint: '噪点有多明显。0 = 关闭，0.18 为默认，过大画面会脏。',
        min: 0,
        max: 0.5,
        step: 0.01,
        format: (v) => v.toFixed(2),
      },
    ],
  },
  {
    title: '运镜 Dolly In',
    desc: '相机沿 Z 轴缓慢推近（像轨道车推进），增加压迫感和电影张力。左右两屏同步。',
    items: [
      {
        key: 'dollyDurationSec',
        label: '推近周期（秒）',
        hint: '从远到近走完一趟要多久。越大越慢、越「史诗感」。',
        min: 10,
        max: 300,
        step: 5,
        format: (v) => `${Math.round(v)}s`,
      },
      {
        key: 'cameraZStart',
        label: '起始距离',
        hint: '相机离屏幕多远（推近前的位置）。',
        min: 1.5,
        max: 6,
        step: 0.1,
        format: (v) => v.toFixed(1),
      },
      {
        key: 'cameraZEnd',
        label: '最近距离',
        hint: '推近后相机最近能到哪。必须小于起始距离。',
        min: 0.8,
        max: 4,
        step: 0.1,
        format: (v) => v.toFixed(1),
      },
    ],
  },
  {
    title: '色调 Tone Mapping',
    desc: 'ACES 电影级色调映射：把 HDR 亮度压进显示器能显示的范围，整体更有「电影感」。',
    items: [
      {
        key: 'toneMappingExposure',
        label: '曝光',
        hint: '整体明暗。略大于 1 更亮，小于 1 更暗更压抑。',
        min: 0.5,
        max: 2,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
    ],
  },
];

/** 创建右侧独立列参数面板；折叠时触发 onLayoutChange 以重算视频视口 */
export function initControlsPanel(
  mountEl: HTMLElement,
  onChange: () => void,
  onLayoutChange: () => void,
): void {
  const panel = document.createElement('aside');
  panel.id = 'controls-panel';
  panel.className = 'controls-panel';

  panel.innerHTML = `
    <button type="button" class="controls-panel__toggle" aria-expanded="true" aria-controls="controls-panel-body">
      <span class="controls-panel__toggle-icon">◀</span>
      <span class="controls-panel__toggle-text">参数面板</span>
    </button>
    <div id="controls-panel-body" class="controls-panel__body">
      <section class="controls-panel__intro">
        <h2>这 Demo 在干什么？</h2>
        <p><strong>左</strong>：MP4 原片，直出无处理。</p>
        <p><strong>中</strong>：同一画面走后期 → 辉光 + 颗粒 + 电影色调。</p>
        <p class="controls-panel__pipeline">VideoTexture → Bloom → 胶片颗粒 → 输出</p>
      </section>
      <div class="controls-panel__groups"></div>
      <label class="controls-panel__check">
        <input type="checkbox" id="ctrl-dolly-enabled" checked />
        <span>启用 Dolly 推近运镜</span>
      </label>
      <button type="button" class="controls-panel__reset">恢复默认</button>
    </div>
  `;

  mountEl.appendChild(panel);

  const toggleBtn = panel.querySelector('.controls-panel__toggle')!;
  const groupsEl = panel.querySelector('.controls-panel__groups')!;
  const dollyCheck = panel.querySelector('#ctrl-dolly-enabled') as HTMLInputElement;
  const resetBtn = panel.querySelector('.controls-panel__reset')!;

  const valueEls = new Map<keyof EnhanceConfig, HTMLSpanElement>();

  toggleBtn.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('controls-panel--collapsed');
    toggleBtn.setAttribute('aria-expanded', String(!collapsed));
    onLayoutChange();
  });

  for (const group of SLIDER_GROUPS) {
    const section = document.createElement('section');
    section.className = 'controls-panel__group';
    section.innerHTML = `
      <h3>${group.title}</h3>
      <p class="controls-panel__group-desc">${group.desc}</p>
    `;

    for (const spec of group.items) {
      const val = enhanceConfig[spec.key] as number;
      const row = document.createElement('div');
      row.className = 'controls-panel__row';
      row.innerHTML = `
        <div class="controls-panel__row-head">
          <label for="ctrl-${spec.key}">${spec.label}</label>
          <span class="controls-panel__value" id="val-${spec.key}">${spec.format?.(val) ?? val}</span>
        </div>
        <input type="range" id="ctrl-${spec.key}" min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${val}" />
        <p class="controls-panel__hint">${spec.hint}</p>
      `;
      section.appendChild(row);

      const input = row.querySelector('input') as HTMLInputElement;
      const valueEl = row.querySelector('.controls-panel__value') as HTMLSpanElement;
      valueEls.set(spec.key, valueEl);

      input.addEventListener('input', () => {
        const num = parseFloat(input.value);
        (enhanceConfig[spec.key] as number) = num;
        valueEl.textContent = spec.format?.(num) ?? String(num);
        onChange();
      });
    }

    groupsEl.appendChild(section);
  }

  dollyCheck.addEventListener('change', () => {
    enhanceConfig.dollyEnabled = dollyCheck.checked;
    onChange();
  });

  resetBtn.addEventListener('click', () => {
    Object.assign(enhanceConfig, {
      bloomStrength: 1.45,
      bloomRadius: 0.72,
      bloomThreshold: 0.18,
      grainIntensity: 0.18,
      dollyDurationSec: 120,
      dollyEnabled: true,
      cameraZStart: 3.2,
      cameraZEnd: 1.6,
      toneMappingExposure: 1.05,
    } satisfies EnhanceConfig);

    dollyCheck.checked = true;

    for (const group of SLIDER_GROUPS) {
      for (const spec of group.items) {
        const input = panel.querySelector(`#ctrl-${spec.key}`) as HTMLInputElement;
        const num = enhanceConfig[spec.key] as number;
        input.value = String(num);
        valueEls.get(spec.key)!.textContent = spec.format?.(num) ?? String(num);
      }
    }

    onChange();
  });
}
