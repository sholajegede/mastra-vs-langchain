"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

type Step = {
  _id: string;
  stepName: string;
  iterationNumber: number;
  status: string;
  timeMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  promptSent?: string;
  output?: string;
  tavilyQuery?: string;
  tavilyResults?: string;
  criticScore?: number;
  criticFeedback?: string;
};

type PipelineResult = {
  _id: string;
  framework: "mastra" | "langchain";
  status: string;
  iterations: number;
  finalScore?: number;
  finalReport?: string;
  totalTimeMs?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  errorMessage?: string;
};

function StatusDot({ status }: { status: string }) {
  const cls =
    status === "complete"
      ? "bg-emerald-400"
      : status === "error"
      ? "bg-red-400"
      : "bg-amber-400 animate-pulse";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}

function TavilyResult({
  result,
}: {
  result: { title: string; url: string; content: string; score?: number };
}) {
  return (
    <div className="rounded border border-zinc-700 bg-zinc-800/50 p-3 space-y-1">
      <p className="text-xs font-medium text-zinc-200 leading-snug">{result.title}</p>
      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-400 hover:text-blue-300 break-all"
      >
        {result.url}
      </a>
      {result.score !== undefined && (
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 rounded bg-zinc-700">
            <div
              className="h-1 rounded bg-emerald-500"
              style={{ width: `${Math.round(result.score * 100)}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500">{(result.score * 100).toFixed(0)}%</span>
        </div>
      )}
      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">{result.content}</p>
    </div>
  );
}

function StepCard({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);
  let tavilyData: Array<{ title: string; url: string; content: string; score?: number }> = [];
  if (step.tavilyResults) {
    try {
      tavilyData = JSON.parse(step.tavilyResults);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <StatusDot status={step.status} />
          <span className="text-sm font-medium text-zinc-200 capitalize">
            {step.stepName}
            {step.iterationNumber > 1 && (
              <span className="ml-1.5 text-xs text-zinc-500">
                #{step.iterationNumber}
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          {step.timeMs !== undefined && (
            <span>{(step.timeMs / 1000).toFixed(1)}s</span>
          )}
          {(step.inputTokens !== undefined || step.outputTokens !== undefined) && (
            <span>
              {step.inputTokens ?? 0}↑&nbsp;{step.outputTokens ?? 0}↓
            </span>
          )}
          {step.model && (
            <span className="hidden sm:inline text-zinc-600">{step.model}</span>
          )}
          <span className="text-zinc-600">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-zinc-800 px-4 py-4 space-y-4">
          {step.stepName === "research" && tavilyData.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Query sent to Tavily
              </p>
              <p className="rounded bg-zinc-800 px-3 py-2 text-xs font-mono text-zinc-300">
                {step.tavilyQuery}
              </p>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mt-3">
                Results
              </p>
              <div className="space-y-2">
                {tavilyData.map((r, i) => (
                  <TavilyResult key={i} result={r} />
                ))}
              </div>
            </div>
          )}

          {step.stepName === "critic" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Score
                </span>
                {step.criticScore !== undefined && (
                  <>
                    <span className="text-lg font-bold text-zinc-100">
                      {step.criticScore}/10
                    </span>
                    <div className="flex-1 h-1.5 rounded bg-zinc-700">
                      <div
                        className={`h-1.5 rounded transition-all ${
                          step.criticScore >= 7
                            ? "bg-emerald-500"
                            : step.criticScore >= 5
                            ? "bg-amber-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${step.criticScore * 10}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
              {step.criticFeedback && (
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {step.criticFeedback}
                </p>
              )}
            </div>
          )}

          {step.promptSent && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Prompt sent to Claude
              </p>
              <pre className="max-h-48 overflow-auto rounded bg-zinc-800 px-3 py-2 text-xs font-mono text-zinc-300 whitespace-pre-wrap">
                {step.promptSent}
              </pre>
            </div>
          )}

          {step.output && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                {step.stepName === "research" ? "Research output" : "Claude's response"}
              </p>
              <pre className="max-h-64 overflow-auto rounded bg-zinc-800 px-3 py-2 text-xs font-mono text-zinc-300 whitespace-pre-wrap">
                {step.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PipelinePanel({
  result,
  steps,
}: {
  result: PipelineResult;
  steps: Step[];
}) {
  const sorted = [...steps].sort((a, b) => {
    const order = ["research", "analysis", "write", "critic"];
    const oi = order.indexOf(a.stepName) * 10 + a.iterationNumber;
    const oj = order.indexOf(b.stepName) * 10 + b.iterationNumber;
    return oi - oj;
  });

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
              result.framework === "mastra"
                ? "bg-zinc-700 text-zinc-200"
                : "bg-zinc-700 text-zinc-200"
            }`}
          >
            {result.framework}
          </span>
          <StatusDot status={result.status} />
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          {result.totalTimeMs !== undefined && (
            <span>{(result.totalTimeMs / 1000).toFixed(1)}s</span>
          )}
          {result.totalInputTokens !== undefined && (
            <span>
              {(result.totalInputTokens + (result.totalOutputTokens ?? 0)).toLocaleString()} tok
            </span>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="p-4 space-y-2">
        {sorted.length === 0 && (
          <p className="text-sm text-zinc-600 text-center py-6">
            Waiting for first step…
          </p>
        )}
        {sorted.map((s) => (
          <StepCard key={s._id} step={s} />
        ))}
      </div>

      {/* Final report */}
      {result.finalReport && (
        <div className="border-t border-zinc-800 px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Final Report
            </p>
            {result.finalScore !== undefined && (
              <span
                className={`text-sm font-bold ${
                  result.finalScore >= 7
                    ? "text-emerald-400"
                    : result.finalScore >= 5
                    ? "text-amber-400"
                    : "text-red-400"
                }`}
              >
                {result.finalScore}/10
              </span>
            )}
          </div>
          <div className="prose prose-sm prose-invert max-w-none">
            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {result.finalReport}
            </div>
          </div>
        </div>
      )}

      {result.errorMessage && (
        <div className="border-t border-red-900 bg-red-950/30 px-5 py-3">
          <p className="text-xs text-red-400">{result.errorMessage}</p>
        </div>
      )}
    </div>
  );
}

function ComparisonTable({
  results,
}: {
  results: PipelineResult[];
}) {
  const mastra = results.find((r) => r.framework === "mastra");
  const lc = results.find((r) => r.framework === "langchain");
  if (!mastra && !lc) return null;

  const rows: [string, string, string][] = [
    [
      "Total time",
      mastra?.totalTimeMs ? `${(mastra.totalTimeMs / 1000).toFixed(1)}s` : "—",
      lc?.totalTimeMs ? `${(lc.totalTimeMs / 1000).toFixed(1)}s` : "—",
    ],
    [
      "Total tokens",
      mastra
        ? ((mastra.totalInputTokens ?? 0) + (mastra.totalOutputTokens ?? 0)).toLocaleString()
        : "—",
      lc
        ? ((lc.totalInputTokens ?? 0) + (lc.totalOutputTokens ?? 0)).toLocaleString()
        : "—",
    ],
    [
      "Input tokens",
      mastra?.totalInputTokens?.toLocaleString() ?? "—",
      lc?.totalInputTokens?.toLocaleString() ?? "—",
    ],
    [
      "Output tokens",
      mastra?.totalOutputTokens?.toLocaleString() ?? "—",
      lc?.totalOutputTokens?.toLocaleString() ?? "—",
    ],
    [
      "Iterations",
      mastra?.iterations?.toString() ?? "—",
      lc?.iterations?.toString() ?? "—",
    ],
    [
      "Final score",
      mastra?.finalScore ? `${mastra.finalScore}/10` : "—",
      lc?.finalScore ? `${lc.finalScore}/10` : "—",
    ],
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-300">Comparison</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left px-5 py-2 text-xs font-medium text-zinc-500 w-1/3">
              Metric
            </th>
            <th className="text-right px-5 py-2 text-xs font-medium text-zinc-400">
              Mastra
            </th>
            <th className="text-right px-5 py-2 text-xs font-medium text-zinc-400">
              LangChain
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, m, l]) => (
            <tr key={label} className="border-b border-zinc-800/50">
              <td className="px-5 py-2 text-zinc-400">{label}</td>
              <td className="px-5 py-2 text-right font-mono text-zinc-200">{m}</td>
              <td className="px-5 py-2 text-right font-mono text-zinc-200">{l}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RunPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId as Id<"runs">;

  const run = useQuery(api.runs.getRun, { runId });
  const pipelineResults = useQuery(
    api.pipelineResults.getPipelineResultsForRun,
    { runId }
  );

  const mastraResult = pipelineResults?.find((r) => r.framework === "mastra");
  const langchainResult = pipelineResults?.find(
    (r) => r.framework === "langchain"
  );

  const mastraSteps = useQuery(
    api.steps.getStepsForPipelineResult,
    mastraResult ? { pipelineResultId: mastraResult._id } : "skip"
  );
  const langchainSteps = useQuery(
    api.steps.getStepsForPipelineResult,
    langchainResult ? { pipelineResultId: langchainResult._id } : "skip"
  );

  if (run === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-zinc-500 text-sm">Loading…</span>
      </div>
    );
  }

  if (run === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-zinc-500 text-sm">Run not found.</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
      {/* Topic header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <StatusDot status={run.status} />
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
            {run.category}
          </span>
        </div>
        <h1 className="text-xl font-bold text-zinc-100 leading-snug">
          {run.topic}
        </h1>
      </div>

      {/* Two-column pipeline panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {mastraResult ? (
          <PipelinePanel
            result={mastraResult as PipelineResult}
            steps={(mastraSteps ?? []) as Step[]}
          />
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="text-sm text-zinc-600">Mastra pipeline starting…</p>
          </div>
        )}

        {langchainResult ? (
          <PipelinePanel
            result={langchainResult as PipelineResult}
            steps={(langchainSteps ?? []) as Step[]}
          />
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="text-sm text-zinc-600">LangChain pipeline starting…</p>
          </div>
        )}
      </div>

      {/* Comparison table */}
      {pipelineResults && pipelineResults.length > 0 && (
        <ComparisonTable results={pipelineResults as PipelineResult[]} />
      )}
    </div>
  );
}
