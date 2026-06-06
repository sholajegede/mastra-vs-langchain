import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { searchTool } from "../tools/search";

export const researcherAgent = new Agent({
  name: "Researcher",
  id: "researcher",
  instructions: `You are a research agent. When given a topic, use the web-search tool to find 5 relevant results.
After searching, return ALL the raw search results including titles, URLs, and content snippets as a single formatted string.
Format: list each result with its title, URL, and a brief content summary.`,
  model: anthropic("claude-haiku-4-5"),
  tools: { searchTool },
});
