import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useCallback, useState } from 'react';
import * as THREE from 'three';
import { ShaderSphere } from './components/ShaderSphere';
import {
  LESSON_GROUPS,
  LESSONS,
  lessonById,
  type LessonId,
} from './learningPath';
import './index.css';

export default function App() {
  const [mouseUv, setMouseUv] = useState(() => new THREE.Vector2(0.5, 0.5));
  const [lessonId, setLessonId] = useState<LessonId>('frag-sincos');
  const lesson = lessonById(lessonId);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouseUv(
      new THREE.Vector2(
        (e.clientX - rect.left) / rect.width,
        1 - (e.clientY - rect.top) / rect.height,
      ),
    );
  }, []);

  return (
    <div className="app">
      <aside className="panel">
        <h1>Shader 学习路径</h1>
        <p className="lead">点按钮切换实验，无需改代码即可对比；对照右侧代码文件深入。</p>

        {LESSON_GROUPS.map((group) => (
          <section key={group.key}>
            <h2>{group.label}</h2>
            <div className="modes">
              {LESSONS.filter((l) => l.group === group.key).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={lessonId === l.id ? 'on' : ''}
                  onClick={() => setLessonId(l.id)}
                >
                  {l.title}
                </button>
              ))}
            </div>
          </section>
        ))}

        <section className="lesson-active">
          <h2>当前实验</h2>
          <p className="lesson-title">{lesson.title}</p>
          <p className="mode-hint">{lesson.hint}</p>
          <p className="code-ref">
            对应代码：<code>{lesson.codeRef}</code>
          </p>
          <dl className="params">
            <dt>timeSpeed</dt>
            <dd>{lesson.timeSpeed}×</dd>
            <dt>uPreset</dt>
            <dd>{lesson.preset}</dd>
            <dt>uFragVariant</dt>
            <dd>{lesson.fragVariant}</dd>
          </dl>
        </section>

        <section className="hint">
          <p>拖拽旋转 · 滚轮缩放 · 移动鼠标（彩虹模式有热点）</p>
          <p style={{ marginTop: 8 }}>
            <a href="/tutorial.html">完整教程 →</a>
          </p>
        </section>
      </aside>

      <div className="canvas-wrap" onPointerMove={onPointerMove}>
        <Canvas camera={{ position: [0, 0, 4], fov: 50 }} gl={{ antialias: true }}>
          <color attach="background" args={['#0a0c12']} />
          <ShaderSphere mouseUv={mouseUv} lesson={lesson} />
          <OrbitControls enableDamping dampingFactor={0.05} />
        </Canvas>
      </div>
    </div>
  );
}
