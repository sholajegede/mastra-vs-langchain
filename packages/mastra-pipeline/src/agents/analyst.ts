import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";

export const analystAgent = new Agent({
  name: "Analyst",
  id: "analyst",
  instructions: `You are an analysis agent. Given research context, extract structured insights.

Always respond with EXACTLY this JSON format (no extra text, no markdown code blocks):
{
  "keyFindings": ["finding1", "finding2", "finding3", "finding4", "finding5"],
  "mainThemes": ["theme1", "theme2", "theme3"],
  "centralArgument": "one clear sentence stating the central argument"
}`,
  model: anthropic("claude-haiku-4-5"),
});
