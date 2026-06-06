import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { PipelineCallbacks } from "shared/src/types";
import { runMastraPipeline } from "mastra-pipeline/src/workflows/pipeline";
import { runLangChainPipeline } from "langchain-pipeline/src/graph/pipeline";

export const maxDuration = 300;

// Hold background tasks so Node doesn't GC them before they finish
const activeTasks = new Map<string, Promise<void>>();

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 800,
  onRetry?: (attempt: number, error: string) => Promise<void>
): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const isConnErr =
        err?.message?.includes("other side closed") ||
        err?.message?.includes("SSL") ||
        err?.message?.includes("ECONNRESET") ||
        err?.message?.includes("ECONNREFUSED");
      if (i < retries && isConnErr) {
        if (onRetry) await onRetry(i + 1, err?.message ?? String(err)).catch(() => {});
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

async function retryMutation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i <= 3; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const msg = e?.message ?? "";
      const causeMsg = e?.cause?.message ?? "";
      const shouldRetry =
        msg === "fetch failed" ||
        msg.includes("fetch") ||
        msg.includes("ECONNRESET") ||
        msg.includes("SSL") ||
        msg.includes("socket hang up") ||
        causeMsg.includes("fetch") ||
        causeMsg.includes("ECONNRESET");
      if (i < 3 && shouldRetry) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error("unreachable");
}

function buildCallbacks(
  runId: Id<"runs">,
  pipelineResultId: Id<"pipelineResults">,
  framework: "mastra" | "langchain"
): PipelineCallbacks {
  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL!;
  const stepIterations = new Map<string, number>();

  const log = async (tag: string, message: string) => {
    try {
      await retryMutation(() =>
        fetchMutation(
          api.pipelineResults.appendLog,
          { id: pipelineResultId, tag, message },
          { url: convexUrl }
        )
      );
    } catch {
      // log errors must never surface to the pipeline
    }
  };

  return {
    onPipelineStart: async () => String(pipelineResultId),

    onPipelineComplete: async (_id, data) => {
      await retryMutation(() =>
        fetchMutation(
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
        )
      );
      await log(
        "DONE",
        `Pipeline complete in ${((data.totalTimeMs ?? 0) / 1000).toFixed(1)}s`
      );
    },

    onPipelineError: async (_id, error) => {
      await retryMutation(() =>
        fetchMutation(
          api.pipelineResults.updatePipelineResult,
          { id: pipelineResultId, status: "error", errorMessage: error },
          { url: convexUrl }
        )
      );
      await log("ERROR", `Pipeline failed: ${error.slice(0, 200)}`);
    },

    step: {
      onStepStart: async (stepName, iterationNumber, input) => {
        const stepId = await retryMutation(() =>
          fetchMutation(
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
          )
        );
        stepIterations.set(String(stepId), iterationNumber);

        if (stepName === "research") {
          await log("SEARCH", `Querying Tavily: "${input.slice(0, 100)}"`);
        } else if (stepName === "analysis") {
          await log("THINK", "Extracting key findings and themes…");
        } else if (stepName === "write") {
          const suffix = iterationNumber > 1 ? ` (revision ${iterationNumber})` : "";
          await log("WRITE", `Drafting structured report${suffix}…`);
        }

        return String(stepId);
      },

      onStepComplete: async (stepId, data) => {
        await retryMutation(() =>
          fetchMutation(
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
              criticDimensions: data.criticDimensions,
            },
            { url: convexUrl }
          )
        );

        if (data.tavilyResults) {
          try {
            const results: Array<{ score?: number }> = JSON.parse(data.tavilyResults);
            const avg =
              results.reduce((s, r) => s + (r.score ?? 0), 0) /
              (results.length || 1);
            await log(
              "RESULT",
              `${results.length} results found (avg relevance: ${(avg * 100).toFixed(0)}%)`
            );
          } catch {}
        }

        if (data.criticScore !== undefined) {
          const iter = stepIterations.get(stepId) ?? 1;
          if (data.criticScore >= 7) {
            await log(
              "SCORE",
              `Draft scored ${data.criticScore}/10 — passes threshold`
            );
          } else {
            await log(
              "LOOP",
              `Score ${data.criticScore}/10 below threshold, revising (iteration ${iter + 1})`
            );
          }
        }
      },

      onStepError: async (stepId, error) => {
        await retryMutation(() =>
          fetchMutation(
            api.steps.updateStep,
            {
              id: stepId as Id<"steps">,
              status: "error",
              errorMessage: error,
            },
            { url: convexUrl }
          )
        );
        await log("ERROR", error.slice(0, 200));
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

  const runId = await retryMutation(() =>
    fetchMutation(
      api.runs.createRun,
      { topic, category },
      { url: convexUrl }
    )
  );

  const [mastraResultId, langchainResultId] = await Promise.all([
    retryMutation(() =>
      fetchMutation(
        api.pipelineResults.createPipelineResult,
        { runId, framework: "mastra" },
        { url: convexUrl }
      )
    ),
    retryMutation(() =>
      fetchMutation(
        api.pipelineResults.createPipelineResult,
        { runId, framework: "langchain" },
        { url: convexUrl }
      )
    ),
  ]);

  const makeRetryHandler =
    (pipelineResultId: Id<"pipelineResults">) =>
    async (attempt: number, _err: string) => {
      await retryMutation(() =>
        fetchMutation(
          api.pipelineResults.updatePipelineResult,
          { id: pipelineResultId, status: "running" },
          { url: convexUrl }
        )
      ).catch(() => {});
      await retryMutation(() =>
        fetchMutation(
          api.pipelineResults.appendLog,
          {
            id: pipelineResultId,
            tag: "RETRY",
            message: `Network error on attempt ${attempt}, retrying…`,
          },
          { url: convexUrl }
        )
      ).catch(() => {});
    };

  // Fire both pipelines in the background — return runId immediately
  const task = Promise.allSettled([
    withRetry(
      () => runMastraPipeline(topic, buildCallbacks(runId, mastraResultId, "mastra")),
      2,
      800,
      makeRetryHandler(mastraResultId)
    ),
    withRetry(
      () =>
        runLangChainPipeline(
          topic,
          buildCallbacks(runId, langchainResultId, "langchain")
        ),
      2,
      800,
      makeRetryHandler(langchainResultId)
    ),
  ])
    .then(async ([mastraRes, langchainRes]) => {
      const finalStatus =
        mastraRes.status === "rejected" || langchainRes.status === "rejected"
          ? "error"
          : "complete";
      await retryMutation(() =>
        fetchMutation(
          api.runs.updateRunStatus,
          { runId, status: finalStatus },
          { url: convexUrl }
        )
      ).catch(console.error);
    })
    .finally(() => {
      activeTasks.delete(String(runId));
    });

  activeTasks.set(String(runId), task);

  return NextResponse.json({ runId: String(runId) });
}
