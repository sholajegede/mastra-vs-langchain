"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

type LogEntry = { timestamp: number; tag: string; message: string };

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
  logs?: LogEntry[];
};

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtTime(ms: number) {
  return (ms / 1000).toFixed(1) + "s";
}

function fmtTs(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

const TAG_COLORS: Record<string, string> = {
  SEARCH: "text-blue-400",
  RESULT: "text-cyan-400",
  THINK: "text-purple-400",
  WRITE: "text-amber-400",
  SCORE: "text-green-400",
  LOOP: "text-orange-400",
  DONE: "text-green-400",
  ERROR: "text-red-400",
  RETRY: "text-yellow-400",
};

function tagColor(tag: string) {
  if (tag === "SCORE") return "text-green-400";
  if (tag === "ERROR") return "text-red-400";
  return TAG_COLORS[tag] ?? "text-[#8b949e]";
}

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex ml-1.5">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-[#484f58] hover:text-[#8b949e] transition-colors text-xs leading-none"
      >
        ⓘ
      </button>
      {show && (
        <span className="absolute left-5 top-0 z-50 w-56 rounded-lg border border-[#21262d] bg-[#0d1117] px-3 py-2 text-xs text-[#8b949e] shadow-xl leading-relaxed">
          {text}
        </span>
      )}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const cls =
    status === "complete"
      ? "bg-green-400"
      : status === "error"
      ? "bg-red-400"
      : "bg-amber-400 animate-pulse";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}

// ─── step progress bar ───────────────────────────────────────────────────────

const STAGES = ["research", "analysis", "write", "critic"] as const;

function stageState(
  name: string,
  allSteps: Step[]
): "pending" | "running" | "done" | "error" {
  const matching = allSteps.filter((s) => s.stepName === name);
  if (matching.some((s) => s.status === "error")) return "error";
  if (matching.some((s) => s.status === "complete")) return "done";
  if (matching.some((s) => s.status === "running")) return "running";
  return "pending";
}

function StepProgressBar({
  mastraSteps,
  langchainSteps,
}: {
  mastraSteps: Step[];
  langchainSteps: Step[];
}) {
  const all = [...mastraSteps, ...langchainSteps];

  return (
    <div className="flex items-center gap-0 justify-center py-6">
      {STAGES.map((stage, i) => {
        const state = stageState(stage, all);
        const circleColor =
          state === "done"
            ? "border-green-400 text-green-400"
            : state === "running"
            ? "border-amber-400 text-amber-400"
            : state === "error"
            ? "border-red-400 text-red-400"
            : "border-[#30363d] text-[#484f58]";
        const labelColor =
          state === "done"
            ? "text-green-400"
            : state === "running"
            ? "text-amber-400 animate-pulse"
            : state === "error"
            ? "text-red-400"
            : "text-[#484f58]";
        const lineColor =
          stageState(STAGES[i + 1] ?? "", all) !== "pending" || state === "done"
            ? "bg-green-400/40"
            : "bg-[#21262d]";

        return (
          <div key={stage} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${circleColor} ${
                  state === "running" ? "animate-pulse" : ""
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </div>
              <span className={`text-xs font-medium capitalize ${labelColor}`}>
                {stage}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`h-px w-12 mx-1 mb-5 ${lineColor}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── live log panel ──────────────────────────────────────────────────────────

function LiveLogPanel({ logs }: { logs?: LogEntry[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs?.length]);

  if (!logs?.length) {
    return (
      <div className="px-4 py-3 text-xs text-[#484f58] font-mono">
        Waiting for pipeline…
      </div>
    );
  }

  return (
    <div className="max-h-52 overflow-y-auto px-4 py-3 space-y-1 font-mono text-xs">
      {logs.map((entry, i) => (
        <div key={i} className="flex gap-2 items-start">
          <span className="text-[#484f58] shrink-0">[{fmtTs(entry.timestamp)}]</span>
          <span className={`font-bold shrink-0 w-14 ${tagColor(entry.tag)}`}>
            {entry.tag}
          </span>
          <span className="text-[#c9d1d9]">{entry.message}</span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

// ─── step card ───────────────────────────────────────────────────────────────

function TavilyResult({
  result,
}: {
  result: { title: string; url: string; content: string; score?: number };
}) {
  return (
    <div className="rounded border border-[#21262d] bg-[#0d1117] p-3 space-y-1">
      <p className="text-xs font-medium text-[#e6edf3] leading-snug">
        {result.title}
      </p>
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
          <div className="flex-1 h-1 rounded bg-[#21262d]">
            <div
              className="h-1 rounded bg-[#2563eb]"
              style={{ width: `${Math.round(result.score * 100)}%` }}
            />
          </div>
          <span className="text-xs text-[#8b949e]">
            {(result.score * 100).toFixed(0)}%
          </span>
        </div>
      )}
      <p className="text-xs text-[#8b949e] leading-relaxed line-clamp-2">
        {result.content}
      </p>
    </div>
  );
}

function StepCard({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [respOpen, setRespOpen] = useState(false);

  let tavilyData: Array<{
    title: string;
    url: string;
    content: string;
    score?: number;
  }> = [];
  if (step.tavilyResults) {
    try {
      tavilyData = JSON.parse(step.tavilyResults);
    } catch {}
  }

  const dotCls =
    step.status === "complete"
      ? "bg-green-400"
      : step.status === "error"
      ? "bg-red-400"
      : "bg-amber-400 animate-pulse";

  return (
    <div className="rounded-lg border border-[#21262d] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1c2128] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`inline-block h-2 w-2 rounded-full ${dotCls}`} />
          <span className="text-sm font-medium text-[#e6edf3] capitalize">
            {step.stepName}
            {step.iterationNumber > 1 && (
              <span className="ml-1.5 text-xs text-[#8b949e]">
                #{step.iterationNumber}
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#8b949e]">
          {step.timeMs !== undefined && <span>{fmtTime(step.timeMs)}</span>}
          {(step.inputTokens !== undefined || step.outputTokens !== undefined) && (
            <span>
              ↑{step.inputTokens ?? 0}&nbsp;↓{step.outputTokens ?? 0}
            </span>
          )}
          {step.model && (
            <span className="hidden sm:inline text-[#484f58]">{step.model}</span>
          )}
          <span className="text-[#484f58]">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-[#21262d] px-4 py-4 space-y-4">
          {/* Tavily results */}
          {step.stepName === "research" && tavilyData.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">
                Tavily query
              </p>
              <p className="rounded bg-[#0d1117] px-3 py-2 text-xs font-mono text-[#e6edf3]">
                {step.tavilyQuery}
              </p>
              <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mt-3">
                Results
              </p>
              <div className="space-y-2">
                {tavilyData.map((r, i) => (
                  <TavilyResult key={i} result={r} />
                ))}
              </div>
            </div>
          )}

          {/* Critic score */}
          {step.stepName === "critic" && step.criticScore !== undefined && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">
                  Score
                </span>
                <span
                  className={`text-2xl font-bold ${
                    step.criticScore >= 7
                      ? "text-green-400"
                      : step.criticScore >= 5
                      ? "text-amber-400"
                      : "text-red-400"
                  }`}
                >
                  {step.criticScore}
                  <span className="text-sm text-[#8b949e] font-normal">/10</span>
                </span>
                <div className="flex-1 h-1.5 rounded bg-[#21262d]">
                  <div
                    className={`h-1.5 rounded ${
                      step.criticScore >= 7
                        ? "bg-green-500"
                        : step.criticScore >= 5
                        ? "bg-amber-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${step.criticScore * 10}%` }}
                  />
                </div>
              </div>
              {step.criticFeedback && (
                <p className="text-sm text-[#c9d1d9] leading-relaxed">
                  {step.criticFeedback}
                </p>
              )}
            </div>
          )}

          {/* Prompt */}
          {step.promptSent && (
            <div className="space-y-1">
              <button
                onClick={() => setPromptOpen((o) => !o)}
                className="flex items-center gap-2 text-xs font-semibold text-[#8b949e] uppercase tracking-wider hover:text-[#e6edf3]"
              >
                <span>Prompt →</span>
                <span>{promptOpen ? "▲" : "▼"}</span>
              </button>
              {promptOpen && (
                <pre className="max-h-48 overflow-auto rounded bg-[#0d1117] border border-[#21262d] px-3 py-2 text-xs font-mono text-[#c9d1d9] whitespace-pre-wrap">
                  {step.promptSent}
                </pre>
              )}
            </div>
          )}

          {/* Response */}
          {step.output && (
            <div className="space-y-1">
              <button
                onClick={() => setRespOpen((o) => !o)}
                className="flex items-center gap-2 text-xs font-semibold text-[#8b949e] uppercase tracking-wider hover:text-[#e6edf3]"
              >
                <span>Response →</span>
                <span>{respOpen ? "▲" : "▼"}</span>
              </button>
              {respOpen && (
                <pre className="max-h-64 overflow-auto rounded bg-[#0d1117] border border-[#21262d] px-3 py-2 text-xs font-mono text-[#c9d1d9] whitespace-pre-wrap">
                  {step.output}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── pipeline panel ──────────────────────────────────────────────────────────

function PipelinePanel({
  result,
  steps,
}: {
  result: PipelineResult;
  steps: Step[];
}) {
  const sorted = [...steps].sort((a, b) => {
    const order = ["research", "analysis", "write", "critic"];
    return (
      order.indexOf(a.stepName) * 10 +
      a.iterationNumber -
      (order.indexOf(b.stepName) * 10 + b.iterationNumber)
    );
  });

  const totalTokens =
    (result.totalInputTokens ?? 0) + (result.totalOutputTokens ?? 0);

  return (
    <div className="rounded-xl border border-[#21262d] bg-[#161b22] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#21262d]">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-[#21262d] text-[#e6edf3]">
            {result.framework === "langchain" ? "LangChain" : "Mastra"}
          </span>
          <StatusDot status={result.status} />
        </div>
        <div className="flex items-center gap-4 text-xs text-[#8b949e]">
          {result.totalTimeMs !== undefined && (
            <span>{fmtTime(result.totalTimeMs)}</span>
          )}
          {totalTokens > 0 && (
            <span>{totalTokens.toLocaleString()} tok</span>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="p-4 space-y-2 flex-1">
        {sorted.length === 0 && (
          <p className="text-sm text-[#484f58] text-center py-6">
            Waiting for first step…
          </p>
        )}
        {sorted.map((s) => (
          <StepCard key={s._id} step={s} />
        ))}
      </div>

      {/* Live log */}
      <div className="border-t border-[#21262d]">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#8b949e] px-4 pt-3 pb-1">
          Live log
        </p>
        <LiveLogPanel logs={result.logs} />
      </div>

      {/* Final report */}
      {result.finalReport && (
        <div className="border-t border-[#21262d] px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">
              Final Report
            </p>
            {result.finalScore !== undefined && (
              <span
                className={`text-sm font-bold ${
                  result.finalScore >= 7
                    ? "text-green-400"
                    : result.finalScore >= 5
                    ? "text-amber-400"
                    : "text-red-400"
                }`}
              >
                {result.finalScore}/10
              </span>
            )}
          </div>
          <div className="text-sm text-[#c9d1d9] leading-relaxed whitespace-pre-wrap">
            {result.finalReport}
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

// ─── comparison table ────────────────────────────────────────────────────────

function ComparisonTable({ results }: { results: PipelineResult[] }) {
  const mastra = results.find((r) => r.framework === "mastra");
  const lc = results.find((r) => r.framework === "langchain");
  if (!mastra && !lc) return null;

  type Row = {
    label: string;
    tooltip: string;
    mVal: number | null;
    lcVal: number | null;
    mFmt: string;
    lcFmt: string;
    lowerWins: boolean;
  };

  const mTime = mastra?.totalTimeMs ?? null;
  const lcTime = lc?.totalTimeMs ?? null;
  const mTok = mastra
    ? (mastra.totalInputTokens ?? 0) + (mastra.totalOutputTokens ?? 0)
    : null;
  const lcTok = lc
    ? (lc.totalInputTokens ?? 0) + (lc.totalOutputTokens ?? 0)
    : null;

  const rows: Row[] = [
    {
      label: "Total time",
      tooltip:
        "Less time means faster responses. Critical for real-time and user-facing applications.",
      mVal: mTime,
      lcVal: lcTime,
      mFmt: mTime != null ? fmtTime(mTime) : "—",
      lcFmt: lcTime != null ? fmtTime(lcTime) : "—",
      lowerWins: true,
    },
    {
      label: "Total tokens",
      tooltip:
        "Fewer tokens means lower API cost. At scale, this difference compounds significantly.",
      mVal: mTok,
      lcVal: lcTok,
      mFmt: mTok != null ? mTok.toLocaleString() : "—",
      lcFmt: lcTok != null ? lcTok.toLocaleString() : "—",
      lowerWins: true,
    },
    {
      label: "Input tokens",
      tooltip:
        "Tokens sent to the model per request. Lower input usage means more efficient prompting.",
      mVal: mastra?.totalInputTokens ?? null,
      lcVal: lc?.totalInputTokens ?? null,
      mFmt: mastra?.totalInputTokens?.toLocaleString() ?? "—",
      lcFmt: lc?.totalInputTokens?.toLocaleString() ?? "—",
      lowerWins: true,
    },
    {
      label: "Output tokens",
      tooltip:
        "Tokens generated by the model. More output can mean more thorough responses or verbosity.",
      mVal: mastra?.totalOutputTokens ?? null,
      lcVal: lc?.totalOutputTokens ?? null,
      mFmt: mastra?.totalOutputTokens?.toLocaleString() ?? "—",
      lcFmt: lc?.totalOutputTokens?.toLocaleString() ?? "—",
      lowerWins: true,
    },
    {
      label: "Iterations",
      tooltip:
        "How many write-critique cycles were needed to reach a passing score. Fewer is more efficient.",
      mVal: mastra?.iterations ?? null,
      lcVal: lc?.iterations ?? null,
      mFmt: mastra?.iterations?.toString() ?? "—",
      lcFmt: lc?.iterations?.toString() ?? "—",
      lowerWins: true,
    },
    {
      label: "Final score",
      tooltip:
        "Quality score assigned by the critic agent out of 10. Measures accuracy, clarity, and depth of the final report.",
      mVal: mastra?.finalScore ?? null,
      lcVal: lc?.finalScore ?? null,
      mFmt: mastra?.finalScore ? `${mastra.finalScore}/10` : "—",
      lcFmt: lc?.finalScore ? `${lc.finalScore}/10` : "—",
      lowerWins: false,
    },
  ];

  function winnerCls(val: number | null, other: number | null, lowerWins: boolean) {
    if (val == null || other == null) return "text-[#e6edf3]";
    const wins = lowerWins ? val < other : val > other;
    const ties = val === other;
    if (ties) return "text-[#e6edf3]";
    return wins ? "text-green-400 font-semibold" : "text-[#8b949e]";
  }

  return (
    <div className="mt-6 rounded-xl border border-[#21262d] bg-[#161b22] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#21262d]">
        <h2 className="text-sm font-semibold text-[#e6edf3]">Comparison</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#21262d]">
            <th className="text-left px-5 py-2 text-xs font-medium text-[#8b949e] w-1/3">
              Metric
            </th>
            <th className="text-right px-5 py-2 text-xs font-medium text-[#e6edf3]">
              Mastra
            </th>
            <th className="text-right px-5 py-2 text-xs font-medium text-[#e6edf3]">
              LangChain
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, tooltip, mVal, lcVal, mFmt, lcFmt, lowerWins }) => (
            <tr key={label} className="border-b border-[#21262d]/50">
              <td className="px-5 py-2 text-[#8b949e]">
                {label}
                <Tooltip text={tooltip} />
              </td>
              <td
                className={`px-5 py-2 text-right font-mono ${winnerCls(
                  mVal,
                  lcVal,
                  lowerWins
                )}`}
              >
                {mFmt}
              </td>
              <td
                className={`px-5 py-2 text-right font-mono ${winnerCls(
                  lcVal,
                  mVal,
                  lowerWins
                )}`}
              >
                {lcFmt}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

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
        <span className="text-[#8b949e] text-sm">Loading…</span>
      </div>
    );
  }
  if (run === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-[#8b949e] text-sm">Run not found.</span>
      </div>
    );
  }

  const allSteps = [...(mastraSteps ?? []), ...(langchainSteps ?? [])] as Step[];

  return (
    <div className="bg-[#0d1117] min-h-screen">
      {/* Topic header */}
      <div className="border-b border-[#21262d] bg-[#161b22]">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs px-2 py-0.5 rounded bg-[#21262d] text-[#8b949e] font-medium">
              {run.category}
            </span>
            <StatusDot status={run.status} />
            <span className="text-xs text-[#8b949e] capitalize">{run.status}</span>
          </div>
          <h1 className="text-xl font-bold text-[#e6edf3] leading-snug">
            {run.topic}
          </h1>
        </div>
      </div>

      {/* Step progress bar */}
      <div className="border-b border-[#21262d] bg-[#0d1117]">
        <div className="mx-auto max-w-7xl px-4">
          <StepProgressBar
            mastraSteps={(mastraSteps ?? []) as Step[]}
            langchainSteps={(langchainSteps ?? []) as Step[]}
          />
        </div>
      </div>

      {/* Two-column panels */}
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {mastraResult ? (
            <PipelinePanel
              result={mastraResult as PipelineResult}
              steps={(mastraSteps ?? []) as Step[]}
            />
          ) : (
            <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-8 text-center">
              <p className="text-sm text-[#484f58]">Mastra pipeline starting…</p>
            </div>
          )}

          {langchainResult ? (
            <PipelinePanel
              result={langchainResult as PipelineResult}
              steps={(langchainSteps ?? []) as Step[]}
            />
          ) : (
            <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-8 text-center">
              <p className="text-sm text-[#484f58]">LangChain pipeline starting…</p>
            </div>
          )}
        </div>

        {pipelineResults && pipelineResults.length > 0 && (
          <ComparisonTable results={pipelineResults as PipelineResult[]} />
        )}
      </div>
    </div>
  );
}
