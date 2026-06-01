#!/usr/bin/env python3
"""
LangGraph 最小可视化 Agent — 生成代码 ↔ 查 Bug ↔ 条件循环

用法:
  pip install -r requirements.txt
  python visual_agent.py              # 运行状态机 + 导出拓扑
  python visual_agent.py --serve      # 导出后用浏览器打开 Canvas 可视化

导出物:
  output/my_agent_brain.png   (需 Graphviz + pygraphviz，可选)
  output/topology.json        (前端 Canvas 渲染用)
  index.html                  (拓扑动效面板)
"""

from __future__ import annotations

import argparse
import http.server
import json
import os
import socket
import sys
import webbrowser
from pathlib import Path
from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output"
TOPOLOGY_JSON = OUT / "topology.json"
PNG_PATH = OUT / "my_agent_brain.png"


# ── 1. 共享状态 ──────────────────────────────────────────────────

class AgentState(TypedDict, total=False):
    has_bug: bool
    iteration: int
    log: list[str]


# ── 2. 节点 ──────────────────────────────────────────────────────

def node_generate_code(state: AgentState) -> AgentState:
    n = state.get("iteration", 0) + 1
    print(f"  [generator] AI 正在生成代码… (第 {n} 轮)")
    log = list(state.get("log", []))
    log.append(f"generator#{n}")
    return {"iteration": n, "log": log, "has_bug": state.get("has_bug", False)}


def node_check_bug(state: AgentState) -> AgentState:
    print("  [evaluator] AI 正在排查 Bug…")
    log = list(state.get("log", []))
    log.append("evaluator")
    # 模拟：前 2 轮有 Bug → 触发循环；第 3 轮通过
    iteration = state.get("iteration", 1)
    has_bug = iteration < 3
    if has_bug:
        print("  [evaluator] 发现 Bug → 条件边回流 generator")
    else:
        print("  [evaluator] 通过 → 走向 END")
    return {"has_bug": has_bug, "log": log, "iteration": iteration}


# ── 3. 条件边 ────────────────────────────────────────────────────

def router_condition(state: AgentState) -> Literal["continue", "exit"]:
    return "continue" if state.get("has_bug") else "exit"


# ── 4. 构图 ──────────────────────────────────────────────────────

def build_app():
    workflow = StateGraph(AgentState)
    workflow.add_node("generator", node_generate_code)
    workflow.add_node("evaluator", node_check_bug)
    workflow.add_edge(START, "generator")
    workflow.add_edge("generator", "evaluator")
    workflow.add_conditional_edges(
        "evaluator",
        router_condition,
        {"continue": "generator", "exit": END},
    )
    return workflow.compile()


# ── 5. 拓扑导出 ──────────────────────────────────────────────────

NODE_META = {
    "__start__": {"label": "START", "color": "#8b949e", "icon": "▶"},
    "generator": {"label": "生成代码", "color": "#58a6ff", "icon": "⚡"},
    "evaluator": {"label": "排查 Bug", "color": "#d29922", "icon": "🔍"},
    "__end__": {"label": "END", "color": "#3fb950", "icon": "✓"},
}


def export_topology_json(app) -> dict:
    g = app.get_graph()
    nodes = []
    for nid in g.nodes:
        meta = NODE_META.get(nid, {"label": nid, "color": "#bc8cff", "icon": "●"})
        nodes.append({"id": nid, **meta})

    edges = []
    for e in g.edges:
        src, dst = e.source, e.target
        edge = {"from": src, "to": dst}
        if e.conditional and e.data:
            edge["conditional"] = True
            edge["label"] = str(e.data)
            if dst == "generator":
                edge["label"] = "continue (有 Bug)"
                edge["color"] = "#ff79c6"
            elif dst == "__end__":
                edge["label"] = "exit (通过)"
                edge["color"] = "#3fb950"
        else:
            edge["color"] = "#58a6ff"
        edges.append(edge)

    payload = {
        "title": "LangGraph Agent 拓扑 — 生成 ↔ 检查 ↔ 循环",
        "nodes": nodes,
        "edges": edges,
        "description": "条件边 evaluator→generator 是可视化核心：能量回流 = 反思重试",
    }
    OUT.mkdir(parents=True, exist_ok=True)
    TOPOLOGY_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  [ok] {TOPOLOGY_JSON.relative_to(ROOT)}")
    return payload


def export_png(app) -> bool:
    try:
        png_bytes = app.get_graph().draw_png()
        OUT.mkdir(parents=True, exist_ok=True)
        PNG_PATH.write_bytes(png_bytes)
        print(f"  [ok] {PNG_PATH.relative_to(ROOT)}")
        return True
    except Exception as e:
        print(f"  [skip] PNG 导出失败: {e}")
        print("         可选: 安装 Graphviz 本体 + pip install pygraphviz")
        print("         或使用 index.html Canvas 可视化 (topology.json)")
        return False


# ── 6. 运行 Agent ────────────────────────────────────────────────

def run_agent(app):
    print("\n--- Agent 运行 trace ---")
    result = app.invoke({"iteration": 0, "log": []})
    print(f"--- 完成: {result.get('log', [])} ---")


# ── 7. HTTP ──────────────────────────────────────────────────────

def find_free_port(start: int = 8770) -> int:
    for port in range(start, start + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return start


def serve(port: int):
    os.chdir(ROOT)
    url = f"http://127.0.0.1:{port}/index.html"
    print(f"\n[*] {url}  (Ctrl+C 停止)")
    webbrowser.open(url)
    http.server.ThreadingHTTPServer(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler).serve_forever()


def main():
    parser = argparse.ArgumentParser(description="LangGraph 可视化 Agent 拓扑 Demo")
    parser.add_argument("--serve", action="store_true", help="导出后启动浏览器可视化")
    parser.add_argument("--port", type=int, default=8770)
    parser.add_argument("--no-run", action="store_true", help="只导出拓扑，不跑 Agent")
    args = parser.parse_args()

    print("=" * 52)
    print("  LangGraph visual_agent — 拓扑导出")
    print("=" * 52)

    app = build_app()
    export_topology_json(app)
    export_png(app)
    if not args.no_run:
        run_agent(app)

    print("=" * 52)
    print("  打开 index.html 查看 Canvas 拓扑动效")
    print("=" * 52)

    if args.serve:
        try:
            serve(find_free_port(args.port))
        except KeyboardInterrupt:
            print("\n[!] 已停止")


if __name__ == "__main__":
    main()
