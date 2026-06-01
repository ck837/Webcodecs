#!/usr/bin/env python3
"""
图生视频 · 扩散模型「物理规律崩坏」可视化 Demo

默认: python main.py          → 主动弹出实时动画窗口（循环播放 4 段模拟）
导出: python main.py --export → 生成 assets/*.gif + index.html

依赖: pip install -r requirements.txt
"""

from __future__ import annotations

import argparse
import http.server
import os
import socket
import sys
import webbrowser
from pathlib import Path

import matplotlib

# 默认交互后端；无 GUI 环境时回退 Agg
def _pick_backend(live: bool) -> str:
    if not live:
        return "Agg"
    for name in ("TkAgg", "Qt5Agg", "WXAgg"):
        try:
            matplotlib.use(name, force=True)
            return name
        except Exception:
            continue
    return "Agg"

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.animation import FuncAnimation, PillowWriter
import numpy as np

plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
OUTPUT_HTML = ROOT / "index.html"
FRAMES = 48
FPS = 15
LIVE_INTERVAL_MS = int(1000 / FPS)
DPI = 100

DEMO_INFO = [
    {
        "key": "1",
        "title": "Latent 外观汤 vs 刚体",
        "console": (
            "【Latent Space】VAE 把 3D 压成 2D 外观特征。\n"
            "  左：刚体平移旋转 — 物理正确\n"
            "  右：Latent 插值 — 每帧重采样宽高比 → 运动变形\n"
            "  工业症状：脸手比例突变、物体被「捏」"
        ),
    },
    {
        "key": "2",
        "title": "Cross-Attention 漂移",
        "console": (
            "【Cross-Attention】参考图/Prompt 通过软对齐注入。\n"
            "  热图峰值从脸部漂到背景 → ID 跟丢\n"
            "  工业症状：换脸感、logo 闪、衣服纹理跳变"
        ),
    },
    {
        "key": "3",
        "title": "帧间独立去噪 → 抖动",
        "console": (
            "【无物理先验】扩散学 plausible 单帧，非唯一轨迹。\n"
            "  左：时序约束 — 平滑\n"
            "  右：每帧独立噪声 — 纹理每帧重掷 → 颤/闪\n"
            "  工业症状：边缘抖、颗粒闪、诡异高频"
        ),
    },
    {
        "key": "4",
        "title": "世界模型修复思路",
        "console": (
            "【World Model / Sora 方向】\n"
            "  显式轨迹 + Identity 锁定 + 光流/时序 + 状态演化\n"
            "  从「每帧猜外观」→「世界接着上一 tick 变」"
        ),
    },
]


# ── 共享绘图 ─────────────────────────────────────────────────────

def _style_ax(ax, title: str, color: str = "#eceff4"):
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_facecolor("#0d1117")
    ax.set_title(title, fontsize=10, color=color, pad=6)


def _draw_person(ax, cx, cy, scale=0.55, ec="#8b7355", fc="#c49a6c"):
    ax.add_patch(mpatches.Ellipse((cx, cy), 0.9 * scale, 1.1 * scale, fc=fc, ec=ec, lw=1.2))
    ax.add_patch(mpatches.Ellipse((cx, cy + 0.55 * scale), 0.45 * scale, 0.52 * scale, fc=fc, ec=ec, lw=1.2))


# ── 四段动画 factory：传入 fig，返回 FuncAnimation ─────────────────

def anim_latent_vs_rigid(fig: plt.Figure) -> FuncAnimation:
    axes = fig.subplots(1, 2)
    fig.patch.set_facecolor("#0d1117")
    titles = ["刚体运动 (物理正确)", "Latent 插值 (外观重采样)"]

    def update(f):
        t = (f % FRAMES) / FRAMES
        for i, ax in enumerate(axes):
            ax.cla()
            _style_ax(ax, titles[i], "#50fa7b" if i == 0 else "#ff79c6")
        cx = 2.5 + t * 5.5
        cy = 5.0 + 0.3 * np.sin(t * 2 * np.pi)
        angle = t * 25
        tr = matplotlib.transforms.Affine2D().rotate_deg_around(cx, cy + 0.55, angle) + axes[0].transData
        for patch in (
            mpatches.Ellipse((cx, cy), 1.8, 2.2, fc="#c49a6c", ec="#50fa7b", lw=1.5),
            mpatches.Ellipse((cx, cy + 0.55), 0.9, 1.0, fc="#c49a6c", ec="#50fa7b", lw=1.5),
        ):
            patch.set_transform(tr)
            axes[0].add_patch(patch)
        rng = np.random.default_rng(f + 42)
        squash = 1.0 + 0.35 * np.sin(t * 5 * np.pi + rng.uniform(-0.5, 0.5))
        stretch = 1.0 + 0.25 * np.cos(t * 7 * np.pi + rng.uniform(-0.5, 0.5))
        axes[1].add_patch(mpatches.Ellipse((cx, cy), 1.8 * stretch, 2.2 * squash, fc="#c49a6c", ec="#ff79c6", lw=1.5))
        axes[1].add_patch(mpatches.Ellipse((cx, cy + 0.55 * stretch), 0.9 * squash, 1.0 * stretch, fc="#c49a6c", ec="#ff79c6", lw=1.5))
        if t > 0.6:
            axes[1].text(5, 1.2, "每帧形状被重采样", ha="center", fontsize=9, color="#ffb86c")
        return []

    return FuncAnimation(fig, update, frames=FRAMES, interval=LIVE_INTERVAL_MS, blit=False, repeat=True)


def anim_attention_drift(fig: plt.Figure) -> FuncAnimation:
    ax = fig.add_subplot(111)
    fig.patch.set_facecolor("#0d1117")
    rng = np.random.default_rng(0)

    def update(f):
        ax.cla()
        _style_ax(ax, "Cross-Attention 热图漂移 -> ID 跟丢", "#ff79c6")
        t = (f % FRAMES) / FRAMES
        face_cx, face_cy = 5.0, 5.8
        ax.add_patch(mpatches.Ellipse((5, 5), 2.2, 3.0, fc="#c49a6c", ec="#8b7355", lw=1.2))
        ax.add_patch(mpatches.Ellipse((face_cx, face_cy), 1.2, 1.35, fc="#c49a6c", ec="#8b7355", lw=1.2))
        for dx in (-0.35, 0.35):
            ax.add_patch(mpatches.Circle((face_cx + dx, face_cy + 0.1), 0.12, fc="#50fa7b"))
        drift = t * 2.2
        att_cx = face_cx + drift + 0.15 * np.sin(t * 8)
        att_cy = face_cy - 0.3 + 0.4 * t + 0.1 * np.cos(t * 6)
        xx, yy = np.meshgrid(np.linspace(0, 10, 80), np.linspace(0, 10, 80))
        heat = np.exp(-((xx - att_cx) ** 2 + (yy - att_cy) ** 2) / (0.55 + 0.1 * rng.random()))
        ax.imshow(heat, extent=(0, 10, 0, 10), origin="lower", cmap="hot", alpha=0.55, aspect="auto")
        ax.plot(att_cx, att_cy, "c+", ms=14, mew=2)
        phase = "早期: 对齐脸部" if t < 0.35 else ("中期: 权重扩散" if t < 0.7 else "后期: 跟到背景")
        ax.text(5, 0.6, phase, ha="center", fontsize=9, color="#ffb86c")
        return []

    return FuncAnimation(fig, update, frames=FRAMES, interval=LIVE_INTERVAL_MS, blit=False, repeat=True)


def anim_temporal_jitter(fig: plt.Figure) -> FuncAnimation:
    axes = fig.subplots(1, 2)
    fig.patch.set_facecolor("#0d1117")

    def draw_scene(ax, noise_level, seed):
        _style_ax(ax, "")
        ax.set_facecolor("#161b22")
        ax.add_patch(mpatches.Rectangle((0, 0), 10, 10, fc="#1a1a3e"))
        ax.add_patch(mpatches.Ellipse((5, 5), 3, 4, fc="#c49a6c", ec="#8b7355", lw=1.5))
        ax.add_patch(mpatches.Ellipse((5, 6.8), 1.4, 1.6, fc="#c49a6c", ec="#8b7355", lw=1.5))
        if noise_level > 0:
            n = np.random.default_rng(seed).normal(0, noise_level, (40, 40))
            ax.imshow(n, extent=(1, 9, 1, 9), cmap="gray", alpha=min(0.7, noise_level * 3),
                      origin="lower", aspect="auto", interpolation="nearest")

    def update(f):
        t = (f % FRAMES) / FRAMES
        for ax in axes:
            ax.cla()
        draw_scene(axes[0], 0.0, 0)
        axes[0].set_title("时序约束: 平滑", fontsize=10, color="#50fa7b", pad=6)
        jitter = 0.08 + 0.06 * abs(np.sin(t * 20 * np.pi))
        draw_scene(axes[1], jitter, f * 17 + 7)
        axes[1].set_title("帧间独立去噪: 闪烁", fontsize=10, color="#ff79c6", pad=6)
        if f % 4 == 0:
            axes[1].text(5, 0.8, "纹理每帧重掷", ha="center", fontsize=8, color="#ffb86c")
        return []

    return FuncAnimation(fig, update, frames=FRAMES, interval=LIVE_INTERVAL_MS, blit=False, repeat=True)


def anim_world_model(fig: plt.Figure) -> FuncAnimation:
    ax = fig.add_subplot(111)
    fig.patch.set_facecolor("#0d1117")
    traj_x = np.linspace(2, 8, FRAMES)
    traj_y = 5 + 0.8 * np.sin(np.linspace(0, 2 * np.pi, FRAMES))

    def update(f):
        fi = f % FRAMES
        ax.cla()
        _style_ax(ax, "世界模型: 显式轨迹 + 时序低通", "#50fa7b")
        ax.plot(traj_x[: fi + 1], traj_y[: fi + 1], "-", color="#7eb8ff", lw=2, alpha=0.8)
        ax.plot(traj_x, traj_y, "--", color="#7eb8ff", lw=0.8, alpha=0.3)
        _draw_person(ax, traj_x[fi], traj_y[fi], ec="#50fa7b")
        for y, txt, col in [
            (8.5, "1. 3D / Depth", "#bd93f9"),
            (7.6, "2. Identity 锁定", "#ffb86c"),
            (6.7, "3. 光流 / 时序", "#50fa7b"),
            (5.8, "4. 状态演化", "#7eb8ff"),
        ]:
            ax.text(1.2, y, txt, fontsize=8, color=col)
        ax.text(5, 0.7, "同一对象沿固定路径 — 外观不重掷", ha="center", fontsize=9, color="#8b949e")
        return []

    return FuncAnimation(fig, update, frames=FRAMES, interval=LIVE_INTERVAL_MS, blit=False, repeat=True)


ANIM_FACTORIES = [
    anim_latent_vs_rigid,
    anim_attention_drift,
    anim_temporal_jitter,
    anim_world_model,
]


# ── 主动执行：实时窗口 ───────────────────────────────────────────

def run_live():
    backend = _pick_backend(live=True)
    if backend == "Agg":
        print("[!] 未检测到 GUI 后端，无法弹窗。请在本机终端运行，或使用 --export")
        build_export()
        return

    print("=" * 50)
    print("  i2v 物理崩坏 Demo — 实时动画")
    print("=" * 50)
    print("  按键: [1][2][3][4] 切换场景  |  [n] 下一个  |  关窗退出")
    print("=" * 50)

    state = {"idx": 0, "anim": None}

    fig = plt.figure(figsize=(10, 5.5), dpi=DPI)
    fig.canvas.manager.set_window_title("图生视频 · 扩散物理崩坏 Demo")  # type: ignore

    def load_demo(idx: int):
        idx = idx % len(ANIM_FACTORIES)
        state["idx"] = idx
        if state["anim"] is not None:
            state["anim"].event_source.stop()  # type: ignore
        fig.clf()
        info = DEMO_INFO[idx]
        fig.suptitle(info["title"], fontsize=13, color="#7eb8ff", y=0.98)
        print(f"\n>>> [{info['key']}] {info['title']}")
        print(info["console"])
        state["anim"] = ANIM_FACTORIES[idx](fig)
        fig.canvas.draw_idle()

    def on_key(event):
        if event.key in ("1", "2", "3", "4"):
            load_demo(int(event.key) - 1)
        elif event.key in ("n", " ", "right"):
            load_demo(state["idx"] + 1)

    fig.canvas.mpl_connect("key_press_event", on_key)
    load_demo(0)
    plt.tight_layout(rect=[0, 0, 1, 0.96])
    plt.show()


# ── 导出 GIF + HTML（可选）────────────────────────────────────────

def _save_gif(fig, anim: FuncAnimation, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    anim.save(str(path), writer=PillowWriter(fps=FPS))
    plt.close(fig)
    print(f"  [ok] {path.relative_to(ROOT)}")


def build_export():
    _pick_backend(live=False)
    print("=" * 50)
    print("  export mode — generating GIF + index.html")
    print("=" * 50)
    ASSETS.mkdir(parents=True, exist_ok=True)
    names = [
        "01-latent-vs-rigid.gif",
        "02-attention-drift.gif",
        "03-temporal-jitter.gif",
        "04-world-model-fix.gif",
    ]
    for i, (factory, name) in enumerate(zip(ANIM_FACTORIES, names)):
        fig = plt.figure(figsize=(10, 5), dpi=DPI)
        anim = factory(fig)
        _save_gif(fig, anim, ASSETS / name)
    generate_html()
    print("=" * 50)
    print("  done -> index.html")
    print("=" * 50)


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>图生视频 · 扩散物理崩坏</title>
  <style>
    body{{background:#07080f;color:#eceff4;font:15px/1.7 system-ui,"PingFang SC",sans-serif;max-width:960px;margin:0 auto;padding:24px}}
    h1{{font-size:24px}} p{{color:#8b90a8}} .card{{background:#12141f;border:1px solid #2a2d3e;border-radius:12px;margin:16px 0;overflow:hidden}}
    .card h2{{padding:12px 16px;margin:0;font-size:16px;border-bottom:1px solid #2a2d3e}}
    img{{width:100%;display:block}} .foot{{padding:10px 16px;font-size:13px;color:#8b90a8}}
  </style>
</head>
<body>
  <h1>图生视频 · 扩散物理崩坏（导出页）</h1>
  <p>实时演示请运行: <code>python main.py</code></p>
  <div class="card"><h2>1 Latent vs 刚体</h2><img src="assets/01-latent-vs-rigid.gif"><div class="foot">运动变形</div></div>
  <div class="card"><h2>2 Attention 漂移</h2><img src="assets/02-attention-drift.gif"><div class="foot">ID 跟丢</div></div>
  <div class="card"><h2>3 帧间抖动</h2><img src="assets/03-temporal-jitter.gif"><div class="foot">高频闪烁</div></div>
  <div class="card"><h2>4 世界模型</h2><img src="assets/04-world-model-fix.gif"><div class="foot">显式轨迹修复</div></div>
</body>
</html>
"""


def generate_html():
    OUTPUT_HTML.write_text(HTML_TEMPLATE, encoding="utf-8")
    print(f"  [ok] index.html")


def serve(port: int):
    os.chdir(ROOT)
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler) as httpd:
        url = f"http://127.0.0.1:{port}/index.html"
        print(f"[*] {url}  (Ctrl+C stop)")
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


def main():
    parser = argparse.ArgumentParser(description="i2v 扩散物理崩坏 — 默认实时弹窗")
    parser.add_argument("--export", action="store_true", help="导出 GIF + index.html（非默认）")
    parser.add_argument("--serve", action="store_true", help="--export 后启动 HTTP")
    parser.add_argument("--port", type=int, default=8766)
    args = parser.parse_args()

    if args.export:
        build_export()
        if args.serve:
            serve(args.port)
    else:
        run_live()


if __name__ == "__main__":
    main()
