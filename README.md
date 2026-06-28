# Parallel Code — AI Agent Build Studio

> A personal fork of [johannesjo/parallel-code](https://github.com/johannesjo/parallel-code) extended into an **AI agent build studio**: the cockpit for designing, building, evaluating, and shipping custom AI agents for client engagements — using parallel coding agents (Claude Code, Codex, Gemini) each isolated in its own git worktree.

Built on the original Parallel Code (Electron · SolidJS · TypeScript), with a **liquid‑glass + hardware‑terminal** UI and a **Studio** layer added on top.

---

## What it does

The base app dispatches AI coding agents in parallel — each task gets its own git branch + worktree, so ten agents can work ten features with zero conflicts; you review the diffs and merge the wins.

This fork adds a **Studio** workflow for building production AI agents for businesses, end to end:

```
client brief  →  scaffold  →  fan out parallel agents  →  evaluate  →  hand off & deploy
```

### Studio features

| Feature                    | What it does                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **✦ Blueprints**           | Scaffold a production agent from battle‑tested archetypes (Support RAG, Document Extraction, Workflow Automation, Ops Copilot, Data Pipeline, Eval & Guardrails). Each seeds a build brief — objective, architecture, deliverables, acceptance criteria. Author/duplicate/edit your **own** blueprints; they persist and compound across engagements. |
| **Stack presets**          | One global **Studio stack** (LangGraph · LlamaIndex · Pydantic AI · Vercel AI SDK · none) appended to every brief so agents build on the right rails. Default: **LangGraph**.                                                                                                                                                                         |
| **⑃ Spec → Build Fan‑out** | Paste a client brief, **✨ auto‑split** it into modules with an LLM, then dispatch **one parallel worktree‑agent per module** — each told what it owns and what its teammates are building, so the work splits cleanly.                                                                                                                               |
| **🎨 Design references**   | Attach design JPG/PNG/SVGs, exported Figma frames, and React/CSS files **per project**. Agents derive and match a cohesive **design system** (palette, type, spacing, components). Injected into both Blueprint and Fan‑out briefs.                                                                                                                   |
| **🧪 Eval Arena**          | Score a prompt/system against a **golden dataset** — deterministic assertions (expected / contains) plus an optional **LLM‑judge** — and get an aggregate pass rate to catch regressions before you ship.                                                                                                                                             |
| **📦 Handoff & Deploy**    | Send a built task’s agent a brief to produce a client‑ready **handoff package** (README, architecture w/ Mermaid, deployment guide, demo, exec summary) and set up deployment for **Docker / Vercel / GCP / AWS / Azure**. Live deploy is **opt‑in** (off = config + instructions only).                                                              |
| **📊 Telemetry**           | Every Studio LLM call (Eval cases, the judge, Fan‑out auto‑split) is metered: **estimated cost, tokens, and latency** (avg + p95), a success rate, and a per‑feature breakdown — so you can see where spend and time go. Estimates (tokens from text length, cost from a per‑provider rate table) for budgeting, not billing.                         |

Plus everything from upstream: tiled panels, focus mode, built‑in diff viewer with inline comments, steps timeline, per‑task notes, shell terminals, Docker sandboxing, phone monitoring, 10+ themes, and the **AI Arena** for racing coding agents head‑to‑head.

---

## Getting started

### Prerequisites

- **Node.js 18+** (developed on v22)
- At least one AI coding CLI installed and authenticated:
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (default; also powers Auto‑split and Eval Arena)
  - [Codex CLI](https://github.com/openai/codex), [Gemini CLI](https://github.com/google-gemini/gemini-cli), or Copilot CLI

### Run from source

```sh
npm install
npm run dev
```

This compiles the Electron main process, builds the MCP server, starts Vite, and opens the app with hot reload.

### Run as a pinnable desktop app (Linux)

A launcher is set up to run the app as a normal, pinnable desktop application that **rebuilds on launch** when you’ve changed the source:

```sh
~/.local/bin/parallel-code-local
```

It’s registered as **Parallel Code (Local)** in your app menu — pin it to the taskbar. (Launches via `electron .` so the Wayland `app_id` matches the desktop entry and the icon stays correct.)

---

## The studio workflow, step by step

1. **Link a project** — point the app at a folder (a new or existing repo) where the client system will live.
2. **(Optional) Add design references** — open **⑃ Fan‑out** → _Design references_ → add mocks / Figma exports / component files for the project.
3. **Scaffold or fan out:**
   - **✦ Blueprints** for a single focused agent, or
   - **⑃ Fan‑out** → paste the brief → **✨ Auto‑split** → tweak modules → **Dispatch** N parallel agents.
4. **Build** — agents work in isolated worktrees. Review diffs, leave inline comments, merge the good branches from the sidebar.
5. **🧪 Eval Arena** — score the prompt/system against a golden dataset before shipping.
6. **📦 Handoff** — pick a built task, choose a deploy target, and generate the client handoff package (and optionally deploy).

---

## Architecture notes (for hacking on it)

- **Theming** is a CSS custom‑property token system: `:root` is the default look (Islands Dark); `html[data-look="…"]` per theme. The glass layer lives in `src/styles/liquid-glass.css`; the SVG refraction in `src/components/GlassFilter.tsx`.
- **Studio code:**
  - `src/lib/blueprints.ts`, `src/lib/stacks.ts` — blueprint catalog + stack presets
  - `src/store/blueprints.ts`, `src/store/fanout.ts`, `src/store/design.ts`, `src/store/handoff.ts`, `src/store/eval.ts`, `src/store/telemetry.ts` — the studio logic
  - `src/lib/ask-once.ts` — one‑shot LLM helper (wraps the streaming `AskAboutCode` IPC) used by Auto‑split and Eval Arena
  - Dialogs: `BlueprintGallery`, `BlueprintEditor`, `FanoutDialog`, `HandoffDialog`, `EvalArenaDialog`, `TelemetryDialog`
- **State** persists to `~/.config/parallel-code-dev/` when run from source (unpackaged), `~/.config/parallel-code/` when packaged. Custom blueprints, the studio stack, and per‑project design refs all persist there.

### Useful scripts

```sh
npm run dev            # hot-reload dev app
npm test               # vitest
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run build          # full electron-builder package (AppImage/deb/dmg)
```

---

## Credits

Forked from **[Parallel Code](https://github.com/johannesjo/parallel-code)** by Johannes Millan (MIT). The original project README is preserved at [`README.upstream.md`](README.upstream.md).

## License

MIT
