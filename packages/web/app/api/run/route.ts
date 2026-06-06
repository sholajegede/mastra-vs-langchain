import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { PipelineCallbacks } from "shared/src/types";
import { runMastraPipeline } from "mastra-pipeline/src/workflows/pipeline";
import { runLangChainPipeline } from "langchain-pipeline/src/graph/pipeline";

export const maxDuration = 300;

function buildCallbacks(
  runId: Id<"runs">,
  pipelineResultId: Id<"pipelineResults">,
  framework: "mastra" | "langchain"
): PipelineCallbacks {
  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL!;

  return {
    onPipelineStart: async () => String(pipelineResultId),

    onPipelineComplete: async (_id, data) => {
      await fetchMutation(
        api.pipelineResults.updatePipelineResult,
        {
          id: pipelineResultId,
          status: "complete",
          iterations: data.iterations,
          finalScore: data.finalScore,
          finalReport: data.finalReport,
          totalTimeMs: data.totalTimeMs,
          totalInputTokens: data.totalInputTokens,
          totalOutputTokens: data.totalOutputTokens,
        },
        { url: convexUrl }
      );
    },

    onPipelineError: async (_id, error) => {
      await fetchMutation(
        api.pipelineResults.updatePipelineResult,
        { id: pipelineResultId, status: "error", errorMessage: error },
        { url: convexUrl }
      );
    },

    step: {
      onStepStart: async (stepName, iterationNumber, input) => {
        const stepId = await fetchMutation(
          api.steps.createStep,
          {
            runId,
            pipelineResultId,
            framework,
            stepName: stepName as "research" | "analysis" | "write" | "critic",
            iterationNumber,
            status: "running",
            input: input.slice(0, 2000),
          },
          { url: convexUrl }
        );
        return String(stepId);
      },

      onStepComplete: async (stepId, data) => {
        await fetchMutation(
          api.steps.updateStep,
          {
            id: stepId as Id<"steps">,
            status: "complete",
            output: data.output.slice(0, 8000),
            promptSent: data.promptSent.slice(0, 8000),
            timeMs: data.timeMs,
            inputTokens: data.inputTokens,
            outputTokens: data.outputTokens,
            model: data.model,
            tavilyQuery: data.tavilyQuery,
            tavilyResults: data.tavilyResults
              ? data.tavilyResults.slice(0, 8000)
              : undefined,
            criticScore: data.criticScore,
            criticFeedback: data.criticFeedback,
          },
          { url: convexUrl }
        );
      },

      onStepError: async (stepId, error) => {
        await fetchMutation(
          api.steps.updateStep,
          {
            id: stepId as Id<"steps">,
            status: "error",
            errorMessage: error,
          },
          { url: convexUrl }
        );
      },
    },
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.topic || !body?.category) {
    return NextResponse.json(
      { error: "topic and category are required" },
      { status: 400 }
    );
  }

  const { topic, category } = body as { topic: string; category: string };
  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL!;

  const runId = await fetchMutation(
    api.runs.createRun,
    { topic, category },
    { url: convexUrl }
  );

  const [mastraResultId, langchainResultId] = await Promise.all([
    fetchMutation(
      api.pipelineResults.createPipelineResult,
      { runId, framework: "mastra" },
      { url: convexUrl }
    ),
    fetchMutation(
      api.pipelineResults.createPipelineResult,
      { runId, framework: "langchain" },
      { url: convexUrl }
    ),
  ]);

  // Run both pipelines in parallel — writes to Convex as each step completes
  const [mastraErr, langchainErr] = await Promise.allSettled([
    runMastraPipeline(topic, buildCallbacks(runId, mastraResultId, "mastra")),
    runLangChainPipeline(
      topic,
      buildCallbacks(runId, langchainResultId, "langchain")
    ),
  ]).then((results) =>
    results.map((r) => (r.status === "rejected" ? r.reason : null))
  );

  const finalStatus =
    mastraErr || langchainErr ? "error" : "complete";
  await fetchMutation(
    api.runs.updateRunStatus,
    { runId, status: finalStatus },
    { url: convexUrl }
  );

  return NextResponse.json({
    runId: String(runId),
    errors: { mastra: mastraErr?.message, langchain: langchainErr?.message },
  });
}
