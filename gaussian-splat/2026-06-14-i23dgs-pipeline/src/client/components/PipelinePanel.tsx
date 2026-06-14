import type { ChangeEvent } from 'react';
import type { GenerateModelRequest } from '../../shared/pipeline';
import type { PipelineJob } from '../../shared/pipeline';
import type { RealSplatScene } from '../gaussian/real-scenes';

interface PipelinePanelProps {
  job?: PipelineJob;
  busy: boolean;
  status: string;
  error?: string;
  onUpload: (file: File) => void;
  onGenerate: (provider: GenerateModelRequest['provider']) => void;
  onLoadMock: () => void;
  onLoadLocalModel: (file: File) => void;
  onLoadRealScene: (scene: RealSplatScene) => void;
  realScenes: RealSplatScene[];
}

const stageLabel: Record<string, string> = {
  uploaded: '已上传',
  matting: '抠图中',
  matted: '主体已提取',
  generating: '生成中',
  ready: '模型就绪',
  failed: '失败'
};

export function PipelinePanel({
  job,
  busy,
  status,
  error,
  onUpload,
  onGenerate,
  onLoadMock,
  onLoadLocalModel,
  onLoadRealScene,
  realScenes
}: PipelinePanelProps): JSX.Element {
  function handleFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0];
    if (file) onUpload(file);
    event.currentTarget.value = '';
  }

  function handleModelFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0];
    if (file) onLoadLocalModel(file);
    event.currentTarget.value = '';
  }

  const canGenerate = Boolean(job?.matted) && job?.stage !== 'generating';

  return (
    <aside className="pipeline-panel" aria-label="i23DGS pipeline">
      <header>
        <div>
          <p className="eyebrow">i23DGS</p>
          <h1>商品图转 3DGS 工作台</h1>
        </div>
        <span className={`stage-pill stage-${job?.stage ?? 'idle'}`}>
          {job ? stageLabel[job.stage] : '待上传'}
        </span>
      </header>

      <label className="upload-zone">
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} disabled={busy} />
        <span>选择商品图片</span>
      </label>

      <div className="quality-note">
        <strong>质量说明</strong>
        <span>本地生成是图像驱动的 2.5D Gaussian baseline，可产出真实 .splat 文件，但不是工业级单图 3D 重建；高精度必须接单图/多图 3DGS 服务或加载外部模型。</span>
      </div>

      <div className="actions">
        <button type="button" onClick={() => onGenerate('mock-local')} disabled={!canGenerate || busy}>
          本地图像高斯
        </button>
        <button type="button" onClick={() => onGenerate('remote-api')} disabled={!canGenerate || busy}>
          远端工业 Provider
        </button>
        <button type="button" className="ghost" onClick={onLoadMock}>
          加载默认耳机
        </button>
      </div>

      <label className="model-zone">
        <input type="file" accept=".splat,.ply,.ksplat" onChange={handleModelFile} />
        <span>加载真实 .splat / .ply / .ksplat</span>
      </label>

      <section className="real-scene-list" aria-label="official real splat scenes">
        <h2>真实 3DGS 样例库</h2>
        {realScenes.map((scene) => (
          <button type="button" className="scene-button" key={scene.id} onClick={() => onLoadRealScene(scene)}>
            <span>{scene.label}</span>
            <small>{scene.sizeMb.toFixed(1)} MB</small>
          </button>
        ))}
      </section>

      <dl className="asset-list">
        <div>
          <dt>原图</dt>
          <dd>{job?.source ? <a href={job.source.url}>查看</a> : '未上传'}</dd>
        </div>
        <div>
          <dt>透明 PNG</dt>
          <dd>{job?.matted ? <a href={job.matted.url}>查看</a> : '等待抠图'}</dd>
        </div>
        <div>
          <dt>高斯模型</dt>
          <dd>{job?.model ? `${job.model.format.toUpperCase()} · ${job.model.splatCount ?? '-'} splats` : '等待生成'}</dd>
        </div>
      </dl>

      <p className={error ? 'status error' : 'status'}>{error ?? status}</p>
    </aside>
  );
}
