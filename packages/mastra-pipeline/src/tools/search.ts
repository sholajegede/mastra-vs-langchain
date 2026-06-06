import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { tavily } from "@tavily/core";

const client = tavily({ apiKey: process.env.TAVILY_API_KEY! });

// Captures the most recent Tavily call so the research step can forward it to callbacks
export let lastTavilyCapture: {
  query: string;
  results: Array<{ title: string; url: string; content: string; score?: number }>;
} | null = null;

export function resetTavilyCapture() {
  lastTavilyCapture = null;
}

export const searchTool = createTool({
  id: "web-search",
  description: "Search the web for information on a topic",
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    lastTavilyCapture = { query, results: [] };
    const results = await client.search(query, {
      maxResults: 5,
      searchDepth: "basic",
    });
    lastTavilyCapture.results = results.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: (r as any).score,
    }));
    return { results: results.results };
  },
});
