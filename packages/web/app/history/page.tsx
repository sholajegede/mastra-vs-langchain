"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";

const CATEGORIES = [
  "All",
  "Technology",
  "Finance",
  "Science",
  "History",
  "Philosophy",
  "Art",
  "Healthcare",
  "Politics",
  "Environment",
  "Business",
];

const CATEGORY_COLORS: Record<string, string> = {
  Technology: "text-blue-400 bg-blue-400/10 border border-blue-400/30",
  Finance: "text-green-400 bg-green-400/10 border border-green-400/30",
  Science: "text-purple-400 bg-purple-400/10 border border-purple-400/30",
  History: "text-amber-400 bg-amber-400/10 border border-amber-400/30",
  Philosophy: "text-indigo-400 bg-indigo-400/10 border border-indigo-400/30",
  Art: "text-pink-400 bg-pink-400/10 border border-pink-400/30",
  Healthcare: "text-red-400 bg-red-400/10 border border-red-400/30",
  Politics: "text-orange-400 bg-orange-400/10 border border-orange-400/30",
  Environment: "text-emerald-400 bg-emerald-400/10 border border-emerald-400/30",
  Business: "text-cyan-400 bg-cyan-400/10 border border-cyan-400/30",
};

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "complete"
      ? "text-green-400 bg-green-400/10 border border-green-400/30"
      : status === "error"
      ? "text-red-400 bg-red-400/10 border border-red-400/30"
      : "text-amber-400 bg-amber-400/10 border border-amber-400/30";
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>
      {status}
    </span>
  );
}

function ScoreBar({
  label,
  score,
  isWinner,
}: {
  label: string;
  score?: number;
  isWinner: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#8b949e]">{label}</span>
        <div className="flex items-center gap-1.5">
          {isWinner && score !== undefined && (
            <span className="text-xs text-green-400">✓</span>
          )}
          <span
            className={`text-xs font-bold ${
              score !== undefined
                ? isWinner
                  ? "text-green-400"
                  : "text-[#8b949e]"
                : "text-[#484f58]"
            }`}
          >
            {score !== undefined ? `${score}/10` : "—"}
          </span>
        </div>
      </div>
      <div className="h-1 rounded bg-[#21262d]">
        {score !== undefined && (
          <div
            className={`h-1 rounded transition-all ${
              isWinner ? "bg-green-500" : "bg-[#30363d]"
            }`}
            style={{ width: `${score * 10}%` }}
          />
        )}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [category, setCategory] = useState("All");

  const runs = useQuery(api.runs.listRuns, {
    category: category === "All" ? undefined : category,
  });

  return (
    <div className="bg-[#0d1117] min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <h1 className="text-xl font-bold text-[#e6edf3]">History</h1>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                category === c
                  ? "bg-[#2563eb] text-white"
                  : "bg-[#161b22] border border-[#21262d] text-[#8b949e] hover:border-[#30363d] hover:text-[#e6edf3]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {runs === undefined && (
          <p className="text-sm text-[#8b949e]">Loading…</p>
        )}

        {runs?.length === 0 && (
          <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-12 text-center">
            <p className="text-sm text-[#8b949e]">No runs yet.</p>
            <Link
              href="/"
              className="mt-3 inline-block text-sm text-[#8b949e] hover:text-[#e6edf3]"
            >
              Run your first topic →
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {runs?.map((run) => {
            const mastra = run.pipelineResults?.find(
              (r: any) => r.framework === "mastra"
            );
            const lc = run.pipelineResults?.find(
              (r: any) => r.framework === "langchain"
            );
            const mScore = mastra?.finalScore;
            const lcScore = lc?.finalScore;
            const mastraWins =
              mScore !== undefined &&
              lcScore !== undefined &&
              mScore > lcScore;
            const langchainWins =
              mScore !== undefined &&
              lcScore !== undefined &&
              lcScore > mScore;

            const catCls =
              CATEGORY_COLORS[run.category] ??
              "text-[#8b949e] bg-[#21262d] border border-[#30363d]";

            return (
              <Link
                key={run._id}
                href={`/run/${run._id}`}
                className="block rounded-xl border border-[#21262d] bg-[#161b22] p-5 hover:border-[#30363d] hover:bg-[#1c2128] transition-colors space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-[#e6edf3] line-clamp-2 leading-snug">
                    {run.topic}
                  </p>
                  <StatusBadge status={run.status} />
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${catCls}`}
                  >
                    {run.category}
                  </span>
                  <span className="text-xs text-[#484f58]">
                    {new Date(run._creationTime).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  <ScoreBar
                    label="Mastra"
                    score={mScore}
                    isWinner={mastraWins}
                  />
                  <ScoreBar
                    label="LangChain"
                    score={lcScore}
                    isWinner={langchainWins}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
