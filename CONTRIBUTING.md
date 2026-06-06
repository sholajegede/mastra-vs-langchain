# Contributing

This tool is built to be extended. The current benchmark covers Mastra vs LangChain, but the architecture is designed so any agent framework can be added and any combination can be run side by side.

## What this tool should become

Right now you can run Mastra vs LangChain on any topic. The goal is for users to select any two or more frameworks and run the same pipeline across all of them simultaneously. Combinations worth building toward:

- Mastra vs LangChain (live)
- Mastra vs CrewAI
- LangChain vs CrewAI
- Mastra vs CopilotKit
- Mastra vs LangChain vs CrewAI (three-way)
- Any combination a user selects from a dropdown

## How the architecture supports this

Every pipeline implements the same `PipelineCallbacks` interface from `packages/shared`:

```typescript
export interface PipelineCallbacks {
  onPipelineStart: () => Promise<string>;
  onPipelineComplete: (id: string, data: PipelineCompleteData) => Promise<void>;
  onPipelineError: (id: string, error: string) => Promise<void>;
  step: {
    onStepStart: (stepName: string, iteration: number, input: string) => Promise<string>;
    onStepComplete: (stepId: string, data: StepCompleteData) => Promise<void>;
    onStepError: (stepId: string, error: string) => Promise<void>;
  };
}
```

A pipeline that implements this interface plugs straight into the dashboard. The web app, the Convex backend, and the live log system all work without any changes.

## Adding a new framework

### 1. Create a new package

```
packages/
  crewai-pipeline/
    src/
      index.ts
    package.json
    tsconfig.json
```

`package.json` needs:
```json
{
  "name": "crewai-pipeline",
  "dependencies": {
    "shared": "*"
  }
}
```

### 2. Export a `run` function

```typescript
// packages/crewai-pipeline/src/index.ts
import { PipelineCallbacks } from "shared/src/types";

export async function runCrewAIPipeline(
  topic: string,
  callbacks: PipelineCallbacks
): Promise<void> {
  const pipelineResultId = await callbacks.onPipelineStart();
  const pipelineStart = Date.now();
  const acc = { inputTokens: 0, outputTokens: 0 };

  // 1. Research step
  const researchId = await callbacks.step.onStepStart("research", 1, topic);
  // ... run research with your framework
  await callbacks.step.onStepComplete(researchId, {
    output: researchOutput,
    promptSent: prompt,
    timeMs: elapsed,
    inputTokens: 0,
    outputTokens: 0,
    model: "tavily-search",
    tavilyQuery: topic,
    tavilyResults: JSON.stringify(results),
  });

  // 2. Analysis, Write, Critic steps follow the same pattern

  await callbacks.onPipelineComplete(pipelineResultId, {
    iterations,
    finalScore,
    finalReport,
    totalTimeMs: Date.now() - pipelineStart,
    totalInputTokens: acc.inputTokens,
    totalOutputTokens: acc.outputTokens,
  });
}
```

The five steps are: `research`, `analysis`, `write`, `critic`. Keep them consistent so the dashboard renders correctly.

Use the same writer and critic instructions from `packages/langchain-pipeline/src/graph/nodes.ts` (`WRITER_INSTRUCTIONS` and `CRITIC_INSTRUCTIONS`) so evaluation is fair across frameworks.

### 3. Register in the API route

In `packages/web/app/api/run/route.ts`, add the new framework to the `POST` handler alongside the existing two. The route currently hardcodes Mastra and LangChain — to support selectable combinations, it needs to accept a `frameworks` array in the request body and run only the selected ones.

### 4. Add to the UI

In `packages/web/app/page.tsx`, replace the single "Run both frameworks" button with a framework selector. Users pick which frameworks to compare and the API runs only those.

In `packages/web/app/run/[runId]/page.tsx`, the two-column grid becomes dynamic based on how many frameworks are running.

## What stays consistent across frameworks

For a fair benchmark, every framework implementation must:

- Use the same model: `claude-haiku-4-5`
- Use the same search tool: Tavily with `maxResults: 5, searchDepth: "basic"`
- Use the same five steps: research, analysis, write, critic, loop
- Use the same writer instructions (`WRITER_INSTRUCTIONS` from `shared` or copied from `nodes.ts`)
- Use the same critic instructions (`CRITIC_INSTRUCTIONS`) so scores are comparable
- Pass `state.research` (the raw Tavily results) to the write step so source fidelity scoring is fair

The evaluation bias section of the article explains why the last point matters.

## Other contributions

**New pipeline types.** The benchmark currently runs a research and synthesis pipeline. A tool-use-under-load pipeline, a multi-agent coordination pipeline, or an error recovery pipeline would each reveal different framework characteristics.

**New evaluation dimensions.** The G-Eval critic currently scores source fidelity, specificity, and insight. A factual accuracy dimension (checked against a ground truth) or a code quality dimension for code-generation pipelines would expand what the benchmark measures.

**New categories.** The history page groups runs by category. More categories mean a richer dataset for comparing framework behaviour across domains.

## Development setup

```bash
git clone https://github.com/sholajegede/mastra-vs-langchain.git
cd mastra-vs-langchain
npm install
cp .env.example .env
# Add ANTHROPIC_API_KEY and TAVILY_API_KEY
npx convex dev   # Terminal 1
npm run web      # Terminal 2
```

Open a pull request against `main`. Include a short description of what framework or feature you added and at least one example run showing it working.