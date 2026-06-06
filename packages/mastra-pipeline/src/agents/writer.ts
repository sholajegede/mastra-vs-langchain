import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";

export const writerAgent = new Agent({
  name: "Writer",
  id: "writer",
  instructions: `You are a professional report writer. Given analysis data (key findings, themes, central argument) and optional feedback, write a structured ~400-word report.

Structure:
1. Introduction paragraph — set the context and state the central argument
2. Three body paragraphs — one per theme, incorporating relevant key findings
3. Conclusion paragraph — synthesize and close

If feedback is provided, address it directly in your revision.
Return ONLY the report text, no extra commentary.`,
  model: anthropic("claude-haiku-4-5"),
});
