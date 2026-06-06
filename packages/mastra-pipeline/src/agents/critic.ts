import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";

export const criticAgent = new Agent({
  name: "Critic",
  id: "critic",
  instructions: `You are a critical editor. Given a report draft, score it from 1 to 10 on three dimensions:
- Accuracy: does it reflect the research findings faithfully?
- Clarity: is it readable, well-structured, and easy to follow?
- Depth: does it go beyond surface-level observations?

Compute a single overall score (average of the three, rounded to nearest integer).

Always respond with EXACTLY this JSON format (no extra text, no markdown code blocks):
{
  "score": <integer 1-10>,
  "feedback": "<specific, actionable feedback on how to improve>"
}`,
  model: anthropic("claude-haiku-4-5"),
});
