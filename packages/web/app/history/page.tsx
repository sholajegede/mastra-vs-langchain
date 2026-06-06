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

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "complete"
      ? "text-emerald-400 bg-emerald-950/50"
      : status === "error"
      ? "text-red-400 bg-red-950/50"
      : "text-amber-400 bg-amber-950/50";
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>
      {status}
    </span>
  );
}

export default function HistoryPage() {
  const [category, setCategory] = useState("All");

  const runs = useQuery(api.runs.listRuns, {
    category: category === "All" ? undefined : category,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <h1 className="text-xl font-bold text-zinc-100">History</h1>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              category === c
                ? "bg-zinc-100 text-zinc-900"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {runs === undefined && (
        <p className="text-sm text-zinc-500">Loading…</p>
      )}

      {runs?.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
          <p className="text-sm text-zinc-500">No runs yet.</p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm text-zinc-400 hover:text-zinc-100"
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
          return (
            <Link
              key={run._id}
              href={`/run/${run._id}`}
              className="block rounded-xl border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-700 hover:bg-zinc-800/50 transition-colors space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-zinc-100 line-clamp-2 leading-snug">
                  {run.topic}
                </p>
                <StatusBadge status={run.status} />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">
                  {run.category}
                </span>
                <span className="text-xs text-zinc-600">
                  {new Date(run._creationTime).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {(mastra || lc) && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Mastra", r: mastra },
                    { label: "LangChain", r: lc },
                  ].map(({ label, r }) => (
                    <div
                      key={label}
                      className="rounded-lg bg-zinc-800/60 px-3 py-2 space-y-0.5"
                    >
                      <p className="text-xs font-medium text-zinc-500">{label}</p>
                      <p className="text-sm font-bold text-zinc-200">
                        {r?.finalScore ? `${r.finalScore}/10` : "—"}
                      </p>
                      <p className="text-xs text-zinc-600">
                        {r?.iterations ? `${r.iterations} iter` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
