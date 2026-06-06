# Agent Showdown

Same multi-step research and synthesis pipeline implemented in two frameworks — **Mastra** and **LangChain/LangGraph** — side by side. Same problem, different orchestration models.

## What it does

Both pipelines run the same five-step process:

1. **Research** — searches the web via Tavily for 5 relevant results on the given topic
2. **Analysis** — extracts 5 key findings, 3 main themes, and 1 central argument
3. **Write** — produces a structured 400-word report with intro, three body paragraphs, and conclusion
4. **Critic** — scores the draft 1–10 on accuracy, clarity, and depth; provides feedback
5. **Loop** — if score < 7 and iterations < 3, sends draft + feedback back to Write; otherwise outputs final report

## Setup

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

Required keys:
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
- `TAVILY_API_KEY` — from [tavily.com](https://tavily.com)

Install dependencies:

```bash
npm install
```

## Running the pipelines

Both commands accept a topic as a command-line argument:

```bash
npm run mastra "the future of AI agents in enterprise software"
npm run langchain "the future of AI agents in enterprise software"
```

If no topic is provided, both default to `"the future of multi-agent AI systems"`.

## Framework comparison

| | Mastra | LangChain/LangGraph |
|---|---|---|
| Orchestration | `createWorkflow` + `createStep` with `.step()` chaining | `StateGraph` with typed state annotations |
| Loop pattern | Conditional branching in workflow | `addConditionalEdges` with router function |
| Agents | `Agent` class with tool support | Node functions with `ChatAnthropic` |
| Structured output | Zod schemas on agent instructions | `.withStructuredOutput()` |
| Model | `claude-haiku-4-5` via `@ai-sdk/anthropic` | `claude-haiku-4-5` via `@langchain/anthropic` |
