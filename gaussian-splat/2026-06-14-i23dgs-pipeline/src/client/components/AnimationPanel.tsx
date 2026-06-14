interface AnimationPanelProps {
  playing: boolean;
  recording: boolean;
  progress: number;
  onPlay: () => void;
  onStop: () => void;
  onRecord: () => void;
  onResetCamera: () => void;
  onPrintCamera: () => void;
}

export function AnimationPanel({
  playing,
  recording,
  progress,
  onPlay,
  onStop,
  onRecord,
  onResetCamera,
  onPrintCamera
}: AnimationPanelProps): JSX.Element {
  return (
    <div className="animation-panel">
      <div className="transport">
        <button type="button" onClick={playing ? onStop : onPlay}>
          {playing ? '停止' : '播放'}
        </button>
        <button type="button" onClick={onRecord} disabled={recording}>
          {recording ? '录制中' : '导出 WebM'}
        </button>
        <button type="button" className="ghost" onClick={onResetCamera}>
          重置镜头
        </button>
        <button type="button" className="ghost" onClick={onPrintCamera}>
          打印视角
        </button>
      </div>
      <div className="timeline" aria-label="camera path progress">
        <i style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </div>
  );
}
