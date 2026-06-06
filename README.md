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

## What this is

The same five-step research and synthesis pipeline, built twice — once in Mastra, once in LangChain/LangGraph — running in parallel on any topic you choose.

Every step is fully instrumented: the Tavily search query and all five results with relevance scores, the exact prompt sent to Claude at each step, the full response, input and output tokens, time per step, and a G-Eval critic that scores the final report across three independent dimensions with chain-of-thought reasoning before each score.

## The web dashboard

Run any topic and see both pipelines execute in real time, side by side.

**Per step you see:**
- Status with live timing
- Input and output token counts
- Model used
- Tavily query and all five results with relevance bars (research step)
- Full prompt sent to Claude (expandable)
- Full response (expandable)
- G-Eval dimension scores with per-dimension reasoning (critic step)

**Live log panel** — scrolling terminal showing tagged events as they happen:

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

**History page** — every run saved to Convex with category filters and score bars. Browse by topic across Technology / Finance / Science / History / Philosophy / Art / Healthcare / Politics / Environment / Business.

**Two explainer sheets on every run page:**
- "How this works" — tabbed view of how Mastra and LangChain each execute the pipeline, why Mastra uses more tokens, and what architectural decisions drive the differences
- "How scoring works" — the G-Eval evaluation system, the three dimensions with weights, the floor rule, and the counterfactual check

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
│     · Conclusion must predict or recommend           │
└─────────────────────────┬────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────┐
│  4. CRITIC  (G-Eval, chain-of-thought)               │
│                                                      │
│  Step 1: Claim Audit                                 │
│    GROUNDED / INFERRED / UNSUPPORTED / HALLUCINATED  │
│                                                      │
│  Step 2: Specificity Audit                           │
│    Flags generic sentences and forbidden phrases     │
│                                                      │
│  Step 3: Insight Audit                               │
│    Checks whether the conclusion adds anything       │
│    beyond restating the introduction                 │
│                                                      │
│  Step 3.5: Counterfactual Check                      │
│    Names one belief a reader gains that they         │
│    could not infer from the topic title alone        │
│                                                      │
│  Step 4: Score three dimensions independently        │
│    Source Fidelity  (40%) — grounded in research?    │
│    Specificity      (30%) — specific, falsifiable?   │
│    Insight          (30%) — worth reading?           │
│                                                      │
│  Floor rule: if any dimension scores 4 or below,    │
│  final score cannot exceed 6                        │
│                                                      │
│  Final = round(fidelity×0.4 + specificity×0.3       │
│                + insight×0.3)                        │
└─────────────────────────┬────────────────────────────┘
                          │
             ┌────────────┴────────────┐
             │  score < 7              │  score >= 7
             │  iterations < 3         │  iterations = 3
             ▼                         ▼
         back to WRITE            FINAL OUTPUT
         with critic feedback
```

## How each framework handles it

| | Mastra | LangChain / LangGraph |
|---|---|---|
| **Orchestration** | `createWorkflow` + `createStep`, linear chain | `StateGraph` with typed `Annotation.Root` state |
| **Loop pattern** | `.dowhile(step, condition)` — first-class | `addConditionalEdges` — graph routing function |
| **Agent definition** | `Agent` class with `id`, `instructions`, `tools` | Plain async node functions with `ChatAnthropic` |
| **Tool definition** | `createTool` with Zod input schema | Direct `@tavily/core` call inside research node |
| **State passing** | Step output schema to next step input schema | Shared mutable state object, partial updates per node |
| **Structured output** | Instruction-level JSON enforcement | `llm.invoke()` with `extractJson()` parser |
| **Context window** | Full Tavily content passed into agent context | Tavily results stored in state, passed selectively |
| **Token usage** | Higher — agent overhead on every step | Lower — developer controls exactly what enters each call |
| **TypeScript** | First-class, full inference end-to-end | Supported, some type casting required |
| **Model** | `claude-haiku-4-5` via `@ai-sdk/anthropic` | `claude-haiku-4-5` via `@langchain/anthropic` |

## What the data shows

**Speed:** LangChain is 25-45% faster in every run. On "The state of TypeScript AI frameworks in 2026": Mastra 28.9s, LangChain 21.6s. On "How LangGraph and Mastra handle agent memory differently": Mastra 43.7s, LangChain 25.6s. The gap widens with longer Tavily results and never reverses.

**Tokens:** Mastra uses 1.5-2.5x more tokens. On the memory topic: Mastra 25,658 total tokens, LangChain 9,720. The research step alone: Mastra 21,280 input tokens, LangChain 0 — because LangChain calls Tavily directly without an LLM. On simpler topics: Mastra ~6,200 tokens, LangChain ~3,900.

**Quality:** Both produce comparable final reports when given the same source material. The G-Eval critic scores vary by how specific and well-grounded the research is, not by which framework ran the pipeline.

**The tradeoff:** Mastra abstracts orchestration into the framework — less wiring code, consistent token and latency overhead. LangChain puts the wiring on you — more explicit, leaner execution.

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
│   │       └── index.ts
│   │
│   ├── langchain-pipeline/
│   │   └── src/
│   │       ├── graph/
│   │       │   ├── state.ts             # Annotation.Root state definition
│   │       │   ├── nodes.ts             # Node functions + retryOnFetch wrapper
│   │       │   └── pipeline.ts          # StateGraph + addConditionalEdges loop
│   │       └── index.ts
│   │
│   └── web/
│       └── app/
│           ├── page.tsx                 # Topic input + example chips
│           ├── run/[runId]/page.tsx     # Live comparison view + explainer sheets
│           └── history/page.tsx         # Categorised run history
│
├── convex/
│   ├── schema.ts                        # runs, pipelineResults, steps
│   ├── runs.ts
│   ├── pipelineResults.ts               # appendLog mutation
│   └── steps.ts
│
├── .env.example
├── package.json
└── README.md
```

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
| `TAVILY_API_KEY` | [tavily.com](https://tavily.com) |

**3. Set up Convex**

```bash
npx convex dev --once
```

Copy the deployment URL into `packages/web/.env.local`:

```
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_URL=https://your-deployment.convex.cloud
```

## Running

**Web dashboard**

```bash
npx convex dev   # Terminal 1
npm run web      # Terminal 2
```

Open `http://localhost:3000`.

**CLI**

```bash
cd packages/mastra-pipeline
npx ts-node src/index.ts "the future of AI agents in enterprise software"

cd packages/langchain-pipeline
npx ts-node src/index.ts "the future of AI agents in enterprise software"
```

## Example topics

| Category | Topic |
|---|---|
| Technology | The state of TypeScript AI frameworks in 2026 |
| Technology | How LangGraph and Mastra handle agent memory differently |
| Technology | Why most RAG implementations fail in production |
| Technology | Multi-agent orchestration patterns for enterprise |
| Technology | The real cost of running AI agents in production |
| Business | How Convex compares to Firebase in 2026 |

## Tech

- <img src="https://raw.githubusercontent.com/sholajegede/mastra-vs-langchain/main/public/mastra-logo.png" width="16" height="16" /> [Mastra](https://mastra.ai) — TypeScript-first AI agent framework (YC W25, $22M Series A)
- <img src="https://raw.githubusercontent.com/sholajegede/mastra-vs-langchain/main/public/langchain-logo.png" width="16" height="16" /> [LangChain / LangGraph](https://langchain.com) — LLM application framework with graph-based agent orchestration
- <img src="https://raw.githubusercontent.com/sholajegede/mastra-vs-langchain/main/public/anthropic-logo.png" width="16" height="16" /> [Claude Haiku 4.5](https://anthropic.com) — LLM powering all agents in both pipelines
- <img src="https://raw.githubusercontent.com/sholajegede/mastra-vs-langchain/main/public/convex-logo.png" width="16" height="16" /> [Convex](https://convex.dev) — Real-time database powering the live dashboard
- <img src="https://raw.githubusercontent.com/sholajegede/mastra-vs-langchain/main/public/tavily-logo.png" width="16" height="16" /> [Tavily](https://tavily.com) — Web search API for the research step
- [Next.js 16](https://nextjs.org) — Web dashboard, App Router