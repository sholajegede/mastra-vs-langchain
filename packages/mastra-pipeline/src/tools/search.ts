import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { tavily } from "@tavily/core";

const client = tavily({ apiKey: process.env.TAVILY_API_KEY! });

export const searchTool = createTool({
  id: "web-search",
  description: "Search the web for information on a topic",
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ context }) => {
    const results = await client.search(context.query, {
      maxResults: 5,
      searchDepth: "basic",
    });
    return { results: results.results };
  },
});
