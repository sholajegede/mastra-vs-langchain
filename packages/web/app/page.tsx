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
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
            Agent Showdown
          </h1>
          <p className="mt-2 text-zinc-400">
            Run the same 5-step research pipeline in{" "}
            <span className="text-zinc-200">Mastra</span> and{" "}
            <span className="text-zinc-200">LangChain/LangGraph</span> side by
            side. Same topic, same model, different orchestration.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Research topic
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. the future of AI agents in enterprise software"
              rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none resize-none"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
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
            className="w-full rounded-lg bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Starting pipelines…" : "Run both frameworks →"}
          </button>
        </form>
      </div>
    </div>
  );
}
