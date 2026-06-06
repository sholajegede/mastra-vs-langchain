<p align="center">
  <img src="https://raw.githubusercontent.com/sholajegede/mastra-vs-langchain/main/public/mastra-logo.png" alt="Mastra" width="48" height="48" />
  &nbsp;&nbsp;&nbsp;
  <strong style="font-size: 24px">vs</strong>
  &nbsp;&nbsp;&nbsp;
  <img src="https://raw.githubusercontent.com/sholajegede/mastra-vs-langchain/main/public/langchain-logo.png" alt="LangChain" width="48" height="48" />
</p>

<h1 align="center">Mastra vs LangChain</h1>

<p align="center">
  You've heard people debate Mastra and LangChain.<br/>
  This actually shows you the difference.
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Mastra" src="https://img.shields.io/badge/Mastra-1.41.0-000000?style=flat-square" />
  <img alt="LangGraph" src="https://img.shields.io/badge/LangGraph-1.3.6-1C3C3C?style=flat-square" />
  <img alt="Claude Haiku" src="https://img.shields.io/badge/Claude-Haiku_4.5-CC785C?style=flat-square&logo=anthropic&logoColor=white" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white" />
  <img alt="Convex" src="https://img.shields.io/badge/Convex-realtime-EE342F?style=flat-square" />
  <img alt="Tavily" src="https://img.shields.io/badge/Tavily-Search-0066FF?style=flat-square" />
</p>

---

## What this is

The same five-step research and synthesis pipeline, built twice — once in Mastra, once in LangChain/LangGraph — running in parallel on any topic you choose.

Every step is instrumented: the Tavily search query, all five results with relevance scores, the exact prompt sent to Claude, the response, input and output tokens, time per step, and a G-Eval critic that scores the final report across three independent dimensions with chain-of-thought reasoning before each score.

The goal is a bias-free, evidence-based answer to the question developers actually need to answer: when does it make sense to use one over the other, and what does the real difference look like in practice?

---

## The web dashboard

Run any topic through the dashboard and see both pipelines execute in real time, side by side.

**What you see per step:**
- Status (running / complete / error) with live timing
- Input and output token counts
- Model used
- Tavily query and all five results with relevance bars (research step)
- Full prompt sent to Claude (expandable)
- Claude's full response (expandable)
- G-Eval critic breakdown with dimension scores and reasoning (critic step)

**Live log panel** — a scrolling terminal below each pipeline showing tagged events as they happen:

| Tag | What it means |
|---|---|
| `SEARCH` | Tavily query fired |
| `RESULT` | Search returned, avg relevance shown |
| `THINK` | Analysis step running |
| `WRITE` | Report being drafted or revised |
| `SCORE` | Critic evaluated the draft |
| `LOOP` | Score below threshold, revision triggered |
| `RETRY` | Transient network error, retrying |
| `DONE` | Pipeline complete |
| `ERROR` | Non-recoverable failure |

**History page** — every run saved to Convex with category filters, score bars per framework, and a winner indicator. Browse runs by topic, compare scores across Technology / Finance / Science / History / Philosophy / Art / Healthcare / Politics / Environment / Business.

**Framework explainer sheet** — a "How this works →" button on every run page opens a slide-over panel that explains step-by-step how Mastra and LangChain each execute the pipeline, why Mastra uses more tokens, and what architectural decisions drive the differences you're seeing.

---

## The pipeline

Both implementations run the same logic. The difference is entirely in how each framework expresses it.

```
Topic
  │
  ▼
┌──────────────────────────────────────────────────────┐
│  1. RESEARCH                                         │
│     Tavily web search → 5 results with relevance     │
│     scores. Raw results passed downstream.           │
└─────────────────────────┬────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────┐
│  2. ANALYSIS                                         │
│     5 key findings · 3 main themes · 1 central       │
│     argument. Structured JSON output.                │
└─────────────────────────┬────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────┐
│  3. WRITE                                            │
│     ~400-word report. Strict requirements:           │
│     · Opening sentence must state a specific finding │
│     · Each paragraph makes exactly one argument      │
│     · Names tools, companies, numbers from research  │
│     · Forbidden phrases list enforced                │
│     · Conclusion must predict or recommend, not      │
│       summarise                                      │
└─────────────────────────┬────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────┐
│  4. CRITIC  (G-Eval, chain-of-thought)               │
│                                                      │
│  Step 1: Claim Audit                                 │
│    Classifies every factual claim as GROUNDED /      │
│    INFERRED / UNSUPPORTED / HALLUCINATED             │
│                                                      │
│  Step 2: Specificity Audit                           │
│    Flags generic sentences and forbidden phrases     │
│                                                      │
│  Step 3: Insight Audit                               │
│    Checks whether the conclusion adds anything       │
│    beyond restating the introduction                 │
│                                                      │
│  Step 4: Score three dimensions independently        │
│    Source Fidelity  (40%) — grounded in research?    │
│    Specificity      (30%) — specific falsifiable      │
│                             claims?                  │
│    Insight          (30%) — worth reading?           │
│                                                      │
│  Final = round(fidelity×0.4 + specificity×0.3        │
│                + insight×0.3)                        │
└─────────────────────────┬────────────────────────────┘
                          │
             ┌────────────┴────────────┐
             │  score < 7              │  score ≥ 7
             │  iterations < 3         │  iterations = 3
             ▼                         ▼
         back to WRITE            FINAL OUTPUT
         with critic feedback     (score reported)
```

---

## How each framework handles it

| | Mastra | LangChain / LangGraph |
|---|---|---|
| **Orchestration** | `createWorkflow` + `createStep`, linear chain | `StateGraph` with typed `Annotation.Root` state |
| **Loop pattern** | `.dowhile(step, condition)` — first-class | `addConditionalEdges` — graph routing function |
| **Agent definition** | `Agent` class with `id`, `instructions`, `tools` | Plain async node functions with `ChatAnthropic` |
| **Tool definition** | `createTool` with Zod input schema | Direct `@tavily/core` call inside research node |
| **State passing** | Step output schema → next step input schema | Shared mutable state object, partial updates per node |
| **Structured output** | Instruction-level JSON enforcement | `.withStructuredOutput(schema)` |
| **Context window** | Full Tavily content passed into agent context | Tavily results stored in state, passed selectively |
| **Token usage** | Higher — agent overhead on every step | Lower — developer controls exactly what enters each call |
| **TypeScript** | First-class, full inference end-to-end | Supported, some type casting required |
| **Model** | `claude-haiku-4-5` via `@ai-sdk/anthropic` | `claude-haiku-4-5` via `@langchain/anthropic` |

---

## What the data shows

Across all runs on this benchmark:

**Speed:** LangChain consistently completes 25-45% faster. Mastra's Agent class initialises its tool loop infrastructure on every step, adding latency even when no tools are called. LangGraph nodes are plain async functions with no framework wrapper.

**Tokens:** Mastra uses 1.5-2.5x more tokens on the same topic. The Agent class passes full Tavily content into its conversation history. On topics with long search results (the memory topic ran 21,280 input tokens on the research step alone), this compounds significantly. LangChain passes only what the node explicitly selects.

**Quality:** Both produce comparable final reports on the same topic. When the G-Eval critic forces revisions, both frameworks loop correctly. The difference is cost and latency, not output quality.

**The tradeoff in plain terms:** Mastra abstracts orchestration complexity into the framework. You write less wiring code but pay a token and latency tax on every step. LangChain puts that wiring code back on you but gives you precise control over every token that enters each model call.

---

## Project structure

```
mastra-vs-langchain/
├── packages/
│   ├── mastra-pipeline/
│   │   └── src/
│   │       ├── tools/search.ts          # Tavily via createTool, captures query + results
│   │       ├── agents/
│   │       │   ├── researcher.ts        # Tavily search agent
│   │       │   ├── analyst.ts           # Structured JSON extraction
│   │       │   ├── writer.ts            # Strict report writer with forbidden phrases
│   │       │   └── critic.ts            # G-Eval critic, 3-dimension scoring
│   │       ├── workflows/pipeline.ts    # createWorkflow + .dowhile() loop
│   │       └── index.ts                 # CLI entry point
│   │
│   ├── langchain-pipeline/
│   │   └── src/
│   │       ├── graph/
│   │       │   ├── state.ts             # Annotation.Root with research, analysis, draft, score
│   │       │   ├── nodes.ts             # Node functions, retryOnFetch wrapper per call
│   │       │   └── pipeline.ts          # StateGraph + addConditionalEdges loop
│   │       └── index.ts                 # CLI entry point
│   │
│   └── web/                             # Next.js 16 App Router dashboard
│       └── app/
│           ├── page.tsx                 # Run page with topic input + example chips
│           ├── run/[runId]/page.tsx     # Live comparison view + explainer sheet
│           └── history/page.tsx         # Categorised run history
│
├── convex/                              # Real-time backend
│   ├── schema.ts                        # runs, pipelineResults, steps tables
│   ├── runs.ts
│   ├── pipelineResults.ts               # appendLog mutation for live logs
│   └── steps.ts
│
├── .env.example
├── package.json                         # npm workspaces root
└── README.md
```

---

## Setup

**1. Clone and install**

```bash
git clone https://github.com/sholajegede/mastra-vs-langchain.git
cd mastra-vs-langchain
npm install
```

**2. Configure environment variables**

```bash
cp .env.example .env
```

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `TAVILY_API_KEY` | [tavily.com](https://tavily.com) — free tier covers this |

**3. Set up Convex**

```bash
npx convex dev --once
```

This creates your Convex deployment and generates the type-safe API. Copy the deployment URL into `packages/web/.env.local`:

```
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_URL=https://your-deployment.convex.cloud
```

---

## Running

**Web dashboard (recommended)**

Two terminals:

```bash
# Terminal 1 — Convex real-time backend
npx convex dev

# Terminal 2 — Next.js dashboard
npm run web
```

Open `http://localhost:3000`, enter a topic, pick a category, and watch both pipelines run in real time.

**CLI (direct)**

```bash
# Mastra
cd packages/mastra-pipeline
npx ts-node src/index.ts "the future of AI agents in enterprise software"

# LangChain
cd packages/langchain-pipeline
npx ts-node src/index.ts "the future of AI agents in enterprise software"
```

Use the same topic on both to make outputs directly comparable.

---

## Example topics by category

| Category | Topic |
|---|---|
| Technology | The state of TypeScript AI frameworks in 2026 |
| Technology | How LangGraph and Mastra handle agent memory differently |
| Technology | Why most RAG implementations fail in production |
| Technology | Multi-agent orchestration patterns for enterprise |
| Technology | The real cost of running AI agents in production |
| Business | How Convex compares to Firebase in 2026 |

---

## Tech

- <img src="https://raw.githubusercontent.com/sholajegede/mastra-vs-langchain/main/public/mastra-logo.png" width="16" height="16" /> [Mastra](https://mastra.ai) — TypeScript-first AI agent framework (YC W25, $22M Series A)
- <img src="https://raw.githubusercontent.com/sholajegede/mastra-vs-langchain/main/public/langchain-logo.png" width="16" height="16" /> [LangChain / LangGraph](https://langchain.com) — LLM application framework with graph-based agent orchestration
- <img src="https://raw.githubusercontent.com/sholajegede/mastra-vs-langchain/main/public/anthropic-logo.png" width="16" height="16" /> [Claude Haiku 4.5](https://anthropic.com) — LLM powering all agents in both pipelines
- <img src="https://raw.githubusercontent.com/sholajegede/mastra-vs-langchain/main/public/convex-logo.png" width="16" height="16" /> [Convex](https://convex.dev) — Real-time database powering the live dashboard
- <img src="https://raw.githubusercontent.com/sholajegede/mastra-vs-langchain/main/public/tavily-logo.png" width="16" height="16" /> [Tavily](https://tavily.com) — Web search API for the research step
- [Next.js 16](https://nextjs.org) — Web dashboard, App Router