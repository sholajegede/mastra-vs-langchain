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
    <div
      className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, #21262d 1px, transparent 0)",
        backgroundSize: "32px 32px",
      }}
    >
      {/* Logo row */}
      <div className="flex items-center gap-4 mb-8">
        <img
          src="/mastra-logo.png"
          alt="Mastra"
          className="w-10 h-10 rounded-xl"
        />
        <span className="text-2xl font-bold text-[#30363d]">vs</span>
        <img
          src="/langchain-logo.png"
          alt="LangChain"
          className="w-10 h-10 rounded-xl"
        />
      </div>

      {/* Title */}
      <h1 className="text-4xl font-bold text-[#e6edf3] tracking-tight text-center mb-3">
        Mastra vs LangChain
      </h1>

      {/* Subtitle */}
      <p className="text-[#8b949e] text-center text-sm max-w-md mb-8 leading-relaxed">
        Same pipeline. Same model. Same topic.
        <br />
        Every token, every step, every decision — visible.
      </p>

      {/* Example chips */}
      <div className="flex flex-wrap gap-2 justify-center mb-8">
        {EXAMPLES.map((e) => (
          <button
            key={e}
            onClick={() => setTopic(e)}
            className="text-xs px-3 py-1.5 rounded-full border border-[#21262d] bg-[#0d1117] text-[#8b949e] hover:border-[#2563eb] hover:text-[#e6edf3] hover:bg-[#0d1f3c] transition-all cursor-pointer"
          >
            {e}
          </button>
        ))}
      </div>

      {/* Form card */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl rounded-2xl border border-[#21262d] bg-[#0d1117] shadow-2xl shadow-black/50 p-6 space-y-5"
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
            className="w-full rounded-lg border border-[#21262d] bg-[#161b22] px-4 py-3 text-sm text-[#e6edf3] placeholder:text-[#484f58] focus:border-[#2563eb] focus:outline-none resize-none transition-colors"
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
            className="w-full rounded-lg border border-[#21262d] bg-[#161b22] px-4 py-2.5 text-sm text-[#e6edf3] focus:border-[#2563eb] focus:outline-none"
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
          className="w-full rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Starting pipelines…" : "Run both frameworks →"}
        </button>
      </form>

      {/* Stats row */}
      <div className="mt-8 flex items-center gap-8 text-center text-xs text-[#484f58]">
        <div>
          <div className="text-[#8b949e] font-semibold text-sm">5 steps</div>
          <div>per pipeline</div>
        </div>
        <div className="h-8 w-px bg-[#21262d]" />
        <div>
          <div className="text-[#8b949e] font-semibold text-sm">Real-time</div>
          <div>Convex sync</div>
        </div>
        <div className="h-px w-px bg-[#21262d]" />
        <div>
          <div className="text-[#8b949e] font-semibold text-sm">Claude Haiku</div>
          <div>both frameworks</div>
        </div>
      </div>
    </div>
  );
}
