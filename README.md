<p align="center">
  <img src="https://raw.githubusercontent.com/sholajegede/mastra-vs-langchain/main/public/mastra-logo.png" alt="Mastra" width="40" height="40" />
  &nbsp;&nbsp;&nbsp;
  <strong>vs</strong>
  &nbsp;&nbsp;&nbsp;
  <img src="https://raw.githubusercontent.com/sholajegede/mastra-vs-langchain/main/public/langchain-logo.png" alt="LangChain" width="40" height="40" />
</p>

<h1 align="center">Mastra vs LangChain</h1>

<p align="center">
  The same multi-step research and synthesis pipeline, built twice.<br/>
  Once with <strong>Mastra</strong>. Once with <strong>LangChain/LangGraph</strong>.<br/>
  Same topic. Same LLM. Same tools. Different orchestration model entirely.
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Mastra" src="https://img.shields.io/badge/Mastra-1.41.0-000000?style=flat-square" />
  <img alt="LangGraph" src="https://img.shields.io/badge/LangGraph-1.3.6-1C3C3C?style=flat-square" />
  <img alt="Claude Haiku" src="https://img.shields.io/badge/Claude-Haiku_4.5-CC785C?style=flat-square&logo=anthropic&logoColor=white" />
  <img alt="Tavily" src="https://img.shields.io/badge/Tavily-Search-0066FF?style=flat-square" />
</p>

---

## What this is

Two implementations of an identical five-step agent pipeline, written side by side to show exactly how Mastra and LangChain/LangGraph differ as orchestration frameworks. The pipeline is real: it searches the web, reasons over the results, writes a structured report, scores it, and loops if the quality bar is not met.

The point is not which framework wins. The point is to show where each one thinks differently, so you can make an informed decision for your own stack.

---

## The pipeline

Both implementations run the exact same logic:

```
Topic
  │
  ▼
┌─────────────────────────────────────────────────────┐
│  1. RESEARCH                                        │
│     Tavily web search → 5 results                   │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│  2. ANALYSIS                                        │
│     5 key findings · 3 themes · 1 central argument  │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│  3. WRITE                                           │
│     ~400-word structured report                     │
│     Intro + 3 body paragraphs + conclusion          │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│  4. CRITIC                                          │
│     Score 1–10 on accuracy, clarity, depth          │
│     Returns { score, feedback }                     │
└────────────────────────┬────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │  score < 7          │  score >= 7
              │  iterations < 3     │  iterations == 3
              ▼                     ▼
          back to WRITE         FINAL OUTPUT
```

---

## How each framework handles it

| | Mastra | LangChain / LangGraph |
|---|---|---|
| **Orchestration unit** | `createWorkflow` + `createStep` | `StateGraph` with typed annotations |
| **Agent definition** | `Agent` class with `id`, `instructions`, `tools` | Node functions with `ChatAnthropic` |
| **Tool definition** | `createTool` with Zod input schema | Direct `@tavily/core` call inside node |
| **Loop pattern** | `.dowhile(step, condition)` | `addConditionalEdges` with router function |
| **State passing** | Step output flows to next step input | Shared mutable state object, partially updated per node |
| **Structured output** | Agent instruction-level JSON enforcement | `.withStructuredOutput(schema)` |
| **Model** | `claude-haiku-4-5` via `@ai-sdk/anthropic` | `claude-haiku-4-5` via `@langchain/anthropic` |
| **TypeScript** | First-class, full inference | Supported, some type casting required |

---

## Project structure

```
mastra-vs-langchain/
├── packages/
│   ├── mastra-pipeline/
│   │   ├── src/
│   │   │   ├── tools/
│   │   │   │   └── search.ts        # Tavily tool via createTool
│   │   │   ├── agents/
│   │   │   │   ├── researcher.ts
│   │   │   │   ├── analyst.ts
│   │   │   │   ├── writer.ts
│   │   │   │   └── critic.ts
│   │   │   ├── workflows/
│   │   │   │   └── pipeline.ts      # createWorkflow with .dowhile()
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── langchain-pipeline/
│       ├── src/
│       │   ├── graph/
│       │   │   ├── state.ts         # Annotation.Root state definition
│       │   │   ├── nodes.ts         # Node functions
│       │   │   └── pipeline.ts      # StateGraph with conditional edges
│       │   └── index.ts
│       └── package.json
│
├── .env.example
├── package.json                     # npm workspaces root
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

Open `.env` and fill in both keys:

| Key | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `TAVILY_API_KEY` | [tavily.com](https://tavily.com) — free tier available |

---

## Running the pipelines

Both commands accept a topic as a command-line argument.

**Mastra:**
```bash
cd packages/mastra-pipeline
npx ts-node src/index.ts "the future of AI agents in enterprise software"
```

**LangChain:**
```bash
cd packages/langchain-pipeline
npx ts-node src/index.ts "the future of AI agents in enterprise software"
```

Use the same topic on both to make the outputs directly comparable.

If no topic is provided, both default to `"the future of multi-agent AI systems"`.

---

## Output format

Both pipelines print in the same format:

```
=== MASTRA PIPELINE ===
Topic: the future of AI agents in enterprise software
Running pipeline...

Iteration 1 — Score: 7/10

--- FINAL REPORT ---
[report text]
====================
```

---

## Key observations

**Mastra** models the pipeline as a linear workflow with explicit step types. Each step has a typed input and output schema. The loop is a first-class construct (`.dowhile`) rather than a routing decision. The mental model is a function pipeline.

**LangGraph** models the same pipeline as a directed graph. State is a single shared object that nodes read from and partially overwrite. The loop is expressed as a conditional edge from the critic node back to the write node. The mental model is a state machine.

Both produce the same output for the same input. The difference is in how you reason about the code when you come back to change it.

---

## Tech

- <img src="https://raw.githubusercontent.com/sholajegede/mastra-vs-langchain/main/public/mastra-logo.png" width="16" height="16" /> [Mastra](https://mastra.ai) — TypeScript-first AI agent framework
- <img src="https://raw.githubusercontent.com/sholajegede/mastra-vs-langchain/main/public/langchain-logo.png" width="16" height="16" /> [LangChain / LangGraph](https://langchain.com) — LLM application framework with graph-based orchestration
- <img src="https://raw.githubusercontent.com/sholajegede/mastra-vs-langchain/main/public/anthropic-logo.png" width="16" height="16" /> [Claude Haiku 4.5](https://anthropic.com) — LLM powering all agents in both pipelines
- [Tavily](https://tavily.com) — Web search API for the research step