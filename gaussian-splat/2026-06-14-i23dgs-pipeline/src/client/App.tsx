import { useCallback, useEffect, useRef, useState } from 'react';
import { applyOrbitAnimation, createOrbitAnimationState, type OrbitAnimationState } from './animation/camera-paths';
import { getJob, requestModelGeneration, uploadProductImage } from './api/pipeline-client';
import { AnimationPanel } from './components/AnimationPanel';
import { PipelinePanel } from './components/PipelinePanel';
import { GaussianStage } from './gaussian/GaussianStage';
import { realSplatScenes, type RealSplatScene } from './gaussian/real-scenes';
import { downloadBlob, startCanvasRecording, type RecorderSession } from './recording/media-recorder';
import type { GenerateModelRequest, PipelineJob } from '../shared/pipeline';
import './styles.css';

const animationMs = 7200;

export function App(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<GaussianStage | null>(null);
  const recorderRef = useRef<RecorderSession | null>(null);
  const animationRef = useRef<number>(0);
  const animationStartRef = useRef<number>(0);
  const orbitStateRef = useRef<OrbitAnimationState | null>(null);
  const [job, setJob] = useState<PipelineJob | undefined>();
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('默认加载耳机示例。上传图片后可生成图像驱动的本地 .splat baseline。');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const stage = new GaussianStage({
      canvas,
      onStatus: setStatus
    });
    stage.showFallbackProduct();
    stageRef.current = stage;
    void stage.loadSplat('/mock/product.splat').catch(() => {
      setStatus('默认耳机 .splat 尚未生成，当前显示 Three.js 占位商品。');
    });
    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!job || job.stage === 'ready' || job.stage === 'failed') return undefined;
    const timer = window.setInterval(async () => {
      try {
        const next = await getJob(job.id);
        setJob(next);
        if (next.stage === 'matted') setStatus('抠图完成。可以生成本地图像高斯 baseline，或调用远端工业 Provider。');
        if (next.stage === 'failed') setError(next.error ?? '流水线失败');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [job]);

  useEffect(() => {
    if (!job?.model?.url) return;
    void stageRef.current?.loadSplat(job.model.url).catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [job?.model?.url]);

  const upload = useCallback(async (file: File) => {
    setBusy(true);
    setError(undefined);
    setStatus('图片已提交，正在进入抠图队列。');
    try {
      const next = await uploadProductImage(file);
      setJob(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const generate = useCallback(async (provider: GenerateModelRequest['provider'] = 'mock-local') => {
    if (!job) return;
    setBusy(true);
    setError(undefined);
    setStatus(provider === 'remote-api'
      ? '正在调用远端 3DGS Provider。需要配置 I23DGS_AI_ENDPOINT。'
      : '正在从透明 PNG 构建本地图像高斯 .splat baseline。');
    try {
      const next = await requestModelGeneration(job.id, provider);
      setJob(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [job]);

  const loadMock = useCallback(() => {
    setError(undefined);
    void stageRef.current?.loadSplat('/mock/product.splat').catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, []);

  const loadLocalModel = useCallback((file: File) => {
    setError(undefined);
    const url = URL.createObjectURL(file);
    setStatus(`正在加载外部模型：${file.name}`);
    void stageRef.current?.loadSplat(url)
      .then(() => setStatus(`已加载外部模型：${file.name}`))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => URL.revokeObjectURL(url));
  }, []);

  const loadRealScene = useCallback((scene: RealSplatScene) => {
    setError(undefined);
    setStatus(`正在加载真实 3DGS：${scene.label} (${scene.sizeMb.toFixed(1)} MB)`);
    void stageRef.current?.loadSplat(scene.url, {
      position: scene.cameraPosition,
      lookAt: scene.lookAt,
      up: scene.cameraUp,
      fov: scene.fov,
      maxDistance: scene.maxDistance
    })
      .then(() => setStatus(`已加载真实 3DGS：${scene.label}。来源：${scene.source}`))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const stopAnimation = useCallback(() => {
    cancelAnimationFrame(animationRef.current);
    setPlaying(false);
    if (recorderRef.current) {
      void recorderRef.current.stop().then((blob) => {
        downloadBlob(blob, `i23dgs-camera-path-${Date.now()}.webm`);
        recorderRef.current = null;
        setRecording(false);
      });
    }
  }, []);

  const playAnimation = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    cancelAnimationFrame(animationRef.current);
    setPlaying(true);
    setProgress(0);
    animationStartRef.current = performance.now();
    orbitStateRef.current = createOrbitAnimationState(stage.camera, stage.controls.target);

    const frame = (now: number): void => {
      const t = Math.min(1, (now - animationStartRef.current) / animationMs);
      if (orbitStateRef.current) applyOrbitAnimation(stage.camera, orbitStateRef.current, t);
      stage.controls.update();
      setProgress(t);
      if (t < 1) {
        animationRef.current = requestAnimationFrame(frame);
      } else {
        stopAnimation();
      }
    };
    animationRef.current = requestAnimationFrame(frame);
  }, [stopAnimation]);

  const recordAnimation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || recording) return;
    recorderRef.current = startCanvasRecording(canvas);
    setRecording(true);
    playAnimation();
  }, [playAnimation, recording]);

  const printCamera = useCallback(() => {
    const snapshot = stageRef.current?.getCameraSnapshot();
    if (!snapshot) return;
    const text = JSON.stringify(snapshot, null, 2);
    console.log('i23DGS camera snapshot', snapshot);
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    setStatus(`当前视角参数已打印并尝试复制到剪贴板：${text}`);
  }, []);

  return (
    <main className="workbench">
      <PipelinePanel
        job={job}
        busy={busy}
        status={status}
        error={error}
        onUpload={upload}
        onGenerate={generate}
        onLoadMock={loadMock}
        onLoadLocalModel={loadLocalModel}
        onLoadRealScene={loadRealScene}
        realScenes={realSplatScenes}
      />
      <section className="viewport-shell" aria-label="3DGS viewport">
        <canvas ref={canvasRef} />
        <div className="viewport-meta">
          <span>OrbitControls</span>
          <span>围绕当前模型中心播放</span>
        </div>
        <AnimationPanel
          playing={playing}
          recording={recording}
          progress={progress}
          onPlay={playAnimation}
          onStop={stopAnimation}
          onRecord={recordAnimation}
          onResetCamera={() => stageRef.current?.resetCamera()}
          onPrintCamera={printCamera}
        />
      </section>
    </main>
  );
}
