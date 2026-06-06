"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CATEGORIES = [
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

const EXAMPLES = [
  "How LangGraph and Mastra handle agent memory differently",
  "The real cost of running AI agents in production",
  "Why most RAG implementations fail in production",
  "Multi-agent orchestration patterns for enterprise",
  "The state of TypeScript AI frameworks in 2026",
];

export default function Home() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("Technology");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), category }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      router.push(`/run/${data.runId}`);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16 bg-[#0d1117]">
      <div className="w-full max-w-2xl">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#e6edf3]">
            Mastra vs LangChain
          </h1>
          <p className="mt-2 text-[#8b949e]">
            The same 5-step research pipeline. Two frameworks.
            <br />
            Every token, every step, every decision — visible.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                onClick={() => setTopic(e)}
                className="text-xs px-3 py-1.5 rounded-full border border-[#30363d] text-[#8b949e] hover:border-[#2563eb] hover:text-[#e6edf3] transition-colors"
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[#21262d] bg-[#161b22] p-6 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-[#e6edf3] mb-2">
              Research topic
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. the future of AI agents in enterprise software"
              rows={3}
              className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-4 py-3 text-sm text-[#e6edf3] placeholder:text-[#484f58] focus:border-[#2563eb] focus:outline-none resize-none"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#e6edf3] mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-4 py-2.5 text-sm text-[#e6edf3] focus:border-[#2563eb] focus:outline-none"
              disabled={loading}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="w-full rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Starting pipelines…" : "Run both frameworks →"}
          </button>
        </form>
      </div>
    </div>
  );
}
