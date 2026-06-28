# Parallel Code — AI Agent Build Studio

> A personal fork of [johannesjo/parallel-code](https://github.com/johannesjo/parallel-code) extended into an **AI agent build studio**: a cockpit for designing, building, evaluating, and shipping custom AI agents for client engagements — using parallel coding agents (Claude Code, Codex, Gemini), each isolated in its own git worktree.

Built on the original Parallel Code (Electron · SolidJS · TypeScript), with a **liquid‑glass + hardware‑terminal** UI (the **Instrument** design system) and a **Studio** layer on top.

---

## Table of contents

1. [What it is](#what-it-is)
2. [The mental model](#the-mental-model)
3. [The delivery pipeline](#the-delivery-pipeline)
4. [Each process, explained](#each-process-explained)
   - [Discovery → Spec](#1--discovery--spec)
   - [Blueprints](#2--blueprints)
   - [Stack presets](#3-stack-presets)
   - [Spec → Build Fan‑out](#4--specbuild-fan-out)
   - [Design references](#5--design-references)
   - [Eval Arena](#6--eval-arena)
   - [Telemetry](#7--telemetry)
   - [Handoff & Deploy](#8--handoff--deploy)
   - [Asset Registry](#9--asset-registry)
5. [Getting started](#getting-started)
6. [A full worked example](#a-full-worked-example-start-to-finish)
7. [The design system (Instrument)](#the-design-system-instrument)
8. [Architecture notes](#architecture-notes-for-hacking-on-it)
9. [Credits & license](#credits)

---

## What it is

The **base app** dispatches AI coding agents in parallel. Each task gets its own git **branch + worktree**, so ten agents can build ten things at once with zero conflicts; you review the diffs and merge the wins. It also has tiled panels, a focus mode, a built‑in diff viewer with inline comments, a steps timeline, per‑task notes, shell terminals, Docker sandboxing, phone monitoring, 10+ themes, and an **AI Arena** for racing coding agents head‑to‑head.

This fork adds a **Studio** — an opinionated workflow for building production AI agents _for businesses_, end to end. It turns the app from "run coding agents in parallel" into "run an agent‑delivery practice."

---

## The mental model

You are an AI engineer delivering custom agents to clients. The studio mirrors how the best delivery teams actually work, which research consistently shows is **map the workflow first, then aim the agent** — not "start with a prompt." Every feature below is one station on that line, and the work **compounds**: prompts, datasets, and design systems you build for one client are reusable for the next.

> **Key idea — the client workflow map.** Before building anything, you capture how the client works _today_: the **steps** in their process, **who** does each (a person, existing software, or — proposed — the agent), the **systems** each step touches, the **rules/SLAs**, and the **painful step** the agent should target. An agent that automates the wrong step, or ignores a system the work depends on, fails no matter how good the prompt is. So you map first, then point the agent at the real bottleneck. The **Discovery → Spec** canvas is where you do this, and it turns that map into the build brief automatically.

---

## The delivery pipeline

```
🗺 Discovery → ✦ Blueprint ─┐
                            ├─→ ⑃ Fan-out → [parallel agents build] → 🧪 Eval → 📦 Handoff
🎨 Design refs ─────────────┘                                          │
◳ Registry  (reusable prompts/guardrails/rubrics feed every stage)     📊 Telemetry (meters every LLM call)
```

All of it is reachable from the **left sidebar** Studio buttons:
**🗺 Discovery · ✦ Blueprints · ⑃ Fan‑out · 📦 Handoff · 🧪 Eval Arena · 📊 Telemetry · ◳ Registry.**

---

## Each process, explained

### 1 · 🗺 Discovery → Spec

**What it's for:** the front door. Capture the client's workflow map and synthesize the build brief from it.

**What you do:**

- Fill in **Client**, **Process**, and a one‑sentence **Objective**.
- Add **workflow steps** — the sequence of what happens today. For each step set the **actor** (`human` / `system` / `agent`), the **systems** it touches, an optional **rule/SLA note**, and flag the **painful** step with ⚑. Reorder with ▲▼.
- Add global **decision points & rules** and **out‑of‑scope** notes.

**What you get:** a structured **build brief** is synthesized live on the right (objective, current workflow, the target/pain, in‑scope capabilities derived from the `agent` steps, integrations from the systems, rules, acceptance criteria). Then:

- **✨ Refine with AI** — tighten the draft into a polished, testable brief with the LLM.
- **◳ Save to registry** — store the brief as a reusable asset.
- **Send to Fan‑out →** — push the brief straight into the Fan‑out dialog to split and build.

_Persisted per project._

### 2 · ✦ Blueprints

**What it's for:** scaffold a production agent from a battle‑tested archetype when you already know the shape of the build.

**What you do:** pick a blueprint — **Support RAG, Document Extraction, Workflow Automation, Ops Copilot, Data Pipeline, Eval & Guardrails** — or author your **own**. Each seeds a build brief (objective, architecture, deliverables, acceptance criteria) into the New Task dialog, where you choose project/agent/isolation and dispatch.

**Custom blueprints** persist and compound across engagements; duplicate a built‑in to customize it, or write one from scratch in the editor.

### 3 · Stack presets

**What it's for:** make every agent build on the right rails.

**What you do:** pick the **Studio stack** once (LangGraph · LlamaIndex · Pydantic AI · Vercel AI SDK · none, default **LangGraph**). It's appended as an authoritative "framework preset" section to every Blueprint and Fan‑out brief at dispatch, so agents don't each pick a different framework.

### 4 · ⑃ Spec→Build Fan‑out

**What it's for:** turn one brief into many parallel agents.

**What you do:**

- Paste (or receive from Discovery) the **client brief**.
- **✨ Auto‑split** — the LLM decomposes the brief into 4–7 clean **modules** (workstreams), or edit the module list by hand.
- **Dispatch** — one coding agent per module, **each in its own worktree**, each told what it owns _and_ what its teammates are building, so the work splits cleanly with minimal overlap.

You then review each agent's diffs and merge the good branches from the sidebar.

### 5 · 🎨 Design references

**What it's for:** make agents build a UI that matches a real design system. (You're a designer — this is for you.)

**What you do:** in Fan‑out, attach **per‑project** design files — JPG/PNG/SVG mocks, exported Figma frames, React/CSS components. The agents derive and match a cohesive design system (palette, type, spacing, components). The references are injected into both Blueprint and Fan‑out briefs.

### 6 · 🧪 Eval Arena

**What it's for:** prove quality before you ship, and catch regressions when you iterate. This is a real eval harness, not a scratchpad — the model the eval platforms (Braintrust, Langfuse, Arize) converge on.

**What you do:**

- Each project gets a **versioned golden dataset**. Add **cases** — an _input_, optional _expected_ / _must‑contain_ assertions; flag a case ⚑ to put it in the **regression suite**.
- Write the **system / prompt under test** (with `{{input}}`). Each run **snapshots the prompt as an immutable version** (v1, v2…), restorable from a dropdown.
- Choose **trials per case** (1×/3×/5×) to measure non‑determinism: you get **pass@k** (≥1 trial passes) and **pass^k** (all trials pass).
- **Run eval.** Results show per‑case ✓/✗, the checks, and the output. The headline shows a **▲/▼ delta vs the previous run** so a prompt change that lowers quality is obvious. Click any past run in the **run history** to inspect it.
- **Graders:** code (expected/contains), **LLM‑judge** (toggle on + a rubric → JSON `{score, pass, reason}`), and **human** — click any result's ✓/✗ to set a verdict that overrides the auto‑score and re‑aggregates.
- **◳ Save prompt to registry** captures a winning system prompt (with its pass rate) into the library.
- **Embed in product →** ships the whole suite into the client's repo (see Handoff).

_Persisted per project: dataset, prompt versions, and run history._

### 7 · 📊 Telemetry

**What it's for:** see where spend and time go across every Studio LLM call.

**What you do:** nothing — it's automatic. Every metered call (eval cases, the judge, auto‑split, Discovery refine) records timestamp, **estimated tokens, latency, and cost**. The dialog shows headline readouts (est. cost, tokens, **avg + p95 latency**, success rate), a **per‑feature breakdown**, and a recent‑calls log.

> Estimates are honest approximations (tokens from text length, cost from a per‑provider rate table) for **budgeting and comparison, not billing** — the underlying CLIs run on subscriptions and don't surface real usage.

### 8 · 📦 Handoff & Deploy

**What it's for:** package a built task for the client.

**What you do:** pick a **built task**, choose a **deploy target** (Docker / Vercel / GCP / AWS / Azure / docs‑only), and generate a client‑ready **handoff package** — `README_CLIENT`, `ARCHITECTURE` (with a Mermaid diagram), `DEPLOYMENT`, `DEMO`, `HANDOFF` (exec summary), `CHANGELOG`.

Two important toggles:

- **Embed evals & telemetry in the product** (default on) — ships a self‑contained eval suite (built from your golden dataset, with a CI gate) **and** a cost/latency telemetry wrapper _into the client's repo_. The delivered system carries its own quality gate and observability, so months later you can re‑run their evals and read their metrics to improve it.
- **Run the deploy now** (default off, opt‑in) — off prepares config + a one‑command deploy and instructions only (safe); on lets the agent run the cloud‑mutating deploy.

### 9 · ◳ Asset Registry

**What it's for:** the **reuse flywheel** — a studio‑wide (cross‑client) library of versioned, reusable assets, so the things that work compound across every engagement.

**What you do:**

- Browse/search a library of **system prompts, prompts, guardrails, eval rubrics, tool specs, and snippets** (six production‑grade starters ship on first open).
- Edit an asset's body and **Save version** — each save is an immutable version. The **version history** offers one‑click **restore** and a real **diff** (color‑coded `+N −M`) of any version → your current body.
- **Reuse:** **Copy**, or **Send to active agent →** (push the asset straight to the focused task's agent). Usage is counted (↺) so your best assets surface.
- **Capture back:** Eval Arena ("Save prompt to registry") and Discovery ("Save to registry") push proven prompts/briefs _into_ the library. Things flow out into your work and back in when they prove out.

---

## Getting started

### Prerequisites

- **Node.js 18+** (developed on v22).
- At least one AI coding CLI installed and authenticated:
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — default; also powers Auto‑split, Eval Arena, and Discovery refine.
  - [Codex CLI](https://github.com/openai/codex), [Gemini CLI](https://github.com/google-gemini/gemini-cli), or Copilot CLI.

### Run from source

```sh
npm install
npm run dev
```

This compiles the Electron main process, builds the MCP server, starts Vite, and opens the app with hot reload.

### Run as a pinnable desktop app (Linux)

A launcher runs the app as a normal, pinnable desktop application that **rebuilds on launch** when you've changed the source:

```sh
~/.local/bin/parallel-code-local
```

It's registered as **Parallel Code (Local)** in your app menu — pin it to the taskbar. (Launches via `electron .` so the Wayland `app_id` matches the desktop entry and the icon stays correct.)

---

## A full worked example, start to finish

A support‑triage agent for a client called **Acme**:

1. **Link a project.** Sidebar → add a project pointing at a new or existing repo.
2. **🗺 Discovery.** Client `Acme`, Process `B2B support triage`, Objective `auto-categorize tickets and draft replies`. Add steps: `Ticket arrives` (system, Zendesk) → `Triage` (human, ⚑ pain) → `Find answer` (human, docs) → `Draft reply` (agent) → `Manager review` (human, "refunds > $500"). Add the rule, mark out‑of‑scope. Hit **✨ Refine with AI**, then **Send to Fan‑out →**.
3. **🎨 Design refs** (optional). In Fan‑out, attach the client's brand mocks so any UI matches.
4. **⑃ Fan‑out.** The brief is prefilled. **✨ Auto‑split** into modules (retrieval, drafting, Zendesk integration, eval/guardrails, API/service…), tweak, **Dispatch**. N agents build in parallel worktrees.
5. **Build.** Review each agent's diffs, leave inline comments, merge the good branches.
6. **🧪 Eval Arena.** Add golden cases (real tickets + expected outcomes), write the system prompt, set 3× trials, **Run eval**. Tune the prompt, re‑run, watch the **▲/▼ delta** and pass^k. **Save prompt to registry** when it's good.
7. **📦 Handoff.** Pick the built task, target **Docker**, keep **Embed evals & telemetry** on, **Generate handoff**. The agent produces the client docs + deploy config, and ships the eval suite + telemetry into Acme's repo.
8. **📊 Telemetry.** Check what the engagement cost in tokens/latency.
9. **◳ Registry.** Next client reuses the prompts, guardrails, and rubrics you just proved out.

---

## The design system (Instrument)

The whole UI is one coherent language called **Instrument** — the studio as a precision device. Reduction (one 8pt grid, one type scale, hairlines over boxes), instrumentation (tabular numerals, small‑caps mono micro‑labels, spring‑press micro‑interactions), and motion as the only curve (static layout, continuous spring transitions). It's enforced in code: design **tokens** live in `src/styles/instrument.css` (referenced type‑safely from `src/lib/tokens.ts`), and every dialog is composed from a small **primitive** vocabulary in `src/components/primitives/` (`Stack · Card · Button · Field · Label · Divider · Metric`) — so consistency is guaranteed by the type system, not by discipline.

---

## Architecture notes (for hacking on it)

- **Theming** is a CSS custom‑property token system: `:root` is the default look (Islands Dark); `html[data-look="…"]` per theme. The glass layer is `src/styles/liquid-glass.css`; the SVG refraction is `src/components/GlassFilter.tsx`; the Instrument tokens/primitives layer is `src/styles/instrument.css` + `src/lib/tokens.ts` + `src/components/primitives/`.
- **Studio logic** (`src/store/`): `discovery.ts`, `blueprints.ts`, `fanout.ts`, `design.ts`, `eval.ts` + `eval-suites.ts`, `telemetry.ts`, `handoff.ts`, `registry.ts`. Catalogs/helpers in `src/lib/`: `blueprints.ts`, `stacks.ts`, `registry-presets.ts`, `ask-once.ts` (one‑shot LLM wrapper over the streaming `AskAboutCode` IPC), `diff.ts`.
- **Studio dialogs** (`src/components/`): `DiscoveryDialog`, `BlueprintGallery`, `BlueprintEditor`, `FanoutDialog`, `EvalArenaDialog`, `TelemetryDialog`, `HandoffDialog`, `RegistryDialog`.
- **State** persists to `~/.config/parallel-code-dev/` from source (unpackaged), `~/.config/parallel-code/` when packaged. Custom blueprints, the studio stack, design refs, eval suites, telemetry, the asset registry, and discovery canvases all persist there.
- **Conventions:** functional SolidJS components only; Electron IPC for all frontend↔backend; `strict: true` TypeScript, no `any`; lint runs at `--max-warnings 0`.

### Useful scripts

```sh
npm run dev             # hot-reload dev app
npm run typecheck       # tsc --noEmit
npm run lint            # eslint --max-warnings 0
npm run build:frontend  # build the renderer (use this to verify the UI compiles)
npm run build           # full electron-builder package (AppImage / deb / dmg)
npm test                # vitest
```

> Note: build the renderer with `npm run build:frontend` (uses `electron/vite.config.electron.ts`). A bare `vite build` is misconfigured and will error on JSX.

---

## Credits

Forked from **[Parallel Code](https://github.com/johannesjo/parallel-code)** by Johannes Millan (MIT). The original project README is preserved at [`README.upstream.md`](README.upstream.md).

## License

MIT
