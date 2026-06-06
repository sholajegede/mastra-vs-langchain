import { ChatAnthropic } from "@langchain/anthropic";
import { tavily } from "@tavily/core";
import { z } from "zod";
import { PipelineStateType } from "./state";

const llm = new ChatAnthropic({ model: "claude-haiku-4-5" });

const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! });

export async function researchNode(
  state: PipelineStateType
): Promise<Partial<PipelineStateType>> {
  const searchResults = await tavilyClient.search(state.topic, {
    maxResults: 5,
    searchDepth: "basic",
  });

  const research = searchResults.results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}\nURL: ${r.url}\nContent: ${r.content}`
    )
    .join("\n\n");

  return { research };
}

export async function analysisNode(
  state: PipelineStateType
): Promise<Partial<PipelineStateType>> {
  const response = await llm.invoke(
    `You are an analysis agent. Given the following research, extract structured insights.

Research:
${state.research}

Respond with EXACTLY this JSON format (no extra text, no markdown code blocks):
{
  "keyFindings": ["finding1", "finding2", "finding3", "finding4", "finding5"],
  "mainThemes": ["theme1", "theme2", "theme3"],
  "centralArgument": "one clear sentence stating the central argument"
}`
  );

  return { analysis: response.content as string };
}

export async function writeNode(
  state: PipelineStateType
): Promise<Partial<PipelineStateType>> {
  let prompt = `You are a professional report writer. Write a structured ~400-word report on: "${state.topic}"

Analysis:
${state.analysis}

Structure:
1. Introduction paragraph — set context and state the central argument
2. Three body paragraphs — one per main theme, incorporating key findings
3. Conclusion paragraph — synthesize and close

Return ONLY the report text, no extra commentary.`;

  if (state.feedback && state.draft) {
    prompt += `\n\nPrevious draft to revise:\n${state.draft}\n\nFeedback to address:\n${state.feedback}`;
  }

  const response = await llm.invoke(prompt);
  const iterations = (state.iterations ?? 0) + 1;

  return { draft: response.content as string, iterations };
}

const criticSchema = z.object({
  score: z.number().int().min(1).max(10),
  feedback: z.string(),
});

export async function criticNode(
  state: PipelineStateType
): Promise<Partial<PipelineStateType>> {
  const structuredLlm = llm.withStructuredOutput(criticSchema);

  const result = await structuredLlm.invoke(
    `You are a critical editor. Score the following report from 1 to 10 on:
- Accuracy: does it reflect the research faithfully?
- Clarity: is it readable and well-structured?
- Depth: does it go beyond surface-level observations?

Compute a single overall score (average of the three, rounded to nearest integer) and provide specific, actionable feedback.

Report:
${state.draft}`
  );

  return { score: result.score, feedback: result.feedback };
}
