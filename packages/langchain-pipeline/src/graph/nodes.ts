import { ChatAnthropic } from "@langchain/anthropic";
import { tavily } from "@tavily/core";
import { z } from "zod";
import { PipelineCallbacks } from "shared/src/types";
import { PipelineStateType } from "./state";

const MODEL = "claude-haiku-4-5";

function makeLLM() {
  return new ChatAnthropic({ model: MODEL });
}

async function retryOnFetch<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      if (
        i < retries &&
        (e?.message?.includes("fetch") ||
          e?.message?.includes("SSL") ||
          e?.message?.includes("ECONNRESET") ||
          e?.message?.includes("other side closed"))
      ) {
        await new Promise((r) => setTimeout(r, 600 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error("unreachable");
}

// Factory: returns node functions that close over callbacks + token accumulators
export function createNodes(
  callbacks: PipelineCallbacks,
  acc: { inputTokens: number; outputTokens: number }
) {
  const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! });

  async function researchNode(
    state: PipelineStateType
  ): Promise<Partial<PipelineStateType>> {
    const stepId = await callbacks.step.onStepStart("research", 1, state.topic);
    const stepStart = Date.now();
    try {
      const searchResults = await tavilyClient.search(state.topic, {
        maxResults: 5,
        searchDepth: "basic",
      });
      const rawResults = searchResults.results.map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: (r as any).score,
      }));
      const research = rawResults
        .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\nContent: ${r.content}`)
        .join("\n\n");

      const timeMs = Date.now() - stepStart;
      await callbacks.step.onStepComplete(stepId, {
        output: research,
        promptSent: state.topic,
        timeMs,
        inputTokens: 0,
        outputTokens: 0,
        model: "tavily-search",
        tavilyQuery: state.topic,
        tavilyResults: JSON.stringify(rawResults),
      });
      return { research };
    } catch (err: any) {
      await callbacks.step.onStepError(stepId, err?.message ?? String(err));
      throw err;
    }
  }

  async function analysisNode(
    state: PipelineStateType
  ): Promise<Partial<PipelineStateType>> {
    const llm = makeLLM();
    const prompt = `You are an analysis agent. Given the following research, extract structured insights.

Research:
${state.research}

Respond with EXACTLY this JSON format (no extra text, no markdown code blocks):
{
  "keyFindings": ["finding1", "finding2", "finding3", "finding4", "finding5"],
  "mainThemes": ["theme1", "theme2", "theme3"],
  "centralArgument": "one clear sentence stating the central argument"
}`;
    const stepId = await callbacks.step.onStepStart(
      "analysis",
      1,
      (state.research ?? "").slice(0, 500)
    );
    const stepStart = Date.now();
    try {
      const response = await retryOnFetch(() => llm.invoke(prompt));
      const timeMs = Date.now() - stepStart;
      const inputTokens = response.usage_metadata?.input_tokens ?? 0;
      const outputTokens = response.usage_metadata?.output_tokens ?? 0;
      acc.inputTokens += inputTokens;
      acc.outputTokens += outputTokens;
      const analysis = response.content as string;
      await callbacks.step.onStepComplete(stepId, {
        output: analysis,
        promptSent: prompt,
        timeMs,
        inputTokens,
        outputTokens,
        model: MODEL,
      });
      return { analysis };
    } catch (err: any) {
      await callbacks.step.onStepError(stepId, err?.message ?? String(err));
      throw err;
    }
  }

  async function writeNode(
    state: PipelineStateType
  ): Promise<Partial<PipelineStateType>> {
    const llm = makeLLM();
    const iteration = (state.iterations ?? 0) + 1;
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
    const stepId = await callbacks.step.onStepStart(
      "write",
      iteration,
      prompt.slice(0, 500)
    );
    const stepStart = Date.now();
    try {
      const response = await retryOnFetch(() => llm.invoke(prompt));
      const timeMs = Date.now() - stepStart;
      const inputTokens = response.usage_metadata?.input_tokens ?? 0;
      const outputTokens = response.usage_metadata?.output_tokens ?? 0;
      acc.inputTokens += inputTokens;
      acc.outputTokens += outputTokens;
      const draft = response.content as string;
      await callbacks.step.onStepComplete(stepId, {
        output: draft,
        promptSent: prompt,
        timeMs,
        inputTokens,
        outputTokens,
        model: MODEL,
      });
      return { draft, iterations: iteration };
    } catch (err: any) {
      await callbacks.step.onStepError(stepId, err?.message ?? String(err));
      throw err;
    }
  }

  const criticSchema = z.object({
    score: z.number().int().min(1).max(10),
    feedback: z.string(),
  });

  async function criticNode(
    state: PipelineStateType
  ): Promise<Partial<PipelineStateType>> {
    const llm = makeLLM();
    const iteration = state.iterations ?? 1;
    const prompt = `You are a critical editor. Score the following report from 1 to 10 on:
- Accuracy: does it reflect the research faithfully?
- Clarity: is it readable and well-structured?
- Depth: does it go beyond surface-level observations?

Compute a single overall score (average of the three, rounded to nearest integer) and provide specific, actionable feedback.

Respond with EXACTLY this JSON format (no extra text, no markdown code blocks):
{
  "score": <integer 1-10>,
  "feedback": "<specific actionable feedback>"
}

Report:
${state.draft}`;
    const stepId = await callbacks.step.onStepStart(
      "critic",
      iteration,
      (state.draft ?? "").slice(0, 500)
    );
    const stepStart = Date.now();
    try {
      const response = await retryOnFetch(() => llm.invoke(prompt));
      const timeMs = Date.now() - stepStart;
      const inputTokens = response.usage_metadata?.input_tokens ?? 0;
      const outputTokens = response.usage_metadata?.output_tokens ?? 0;
      acc.inputTokens += inputTokens;
      acc.outputTokens += outputTokens;
      const rawText = response.content as string;
      let parsed: { score: number; feedback: string };
      try {
        parsed = criticSchema.parse(JSON.parse(rawText));
      } catch {
        parsed = { score: 7, feedback: "Score parsing failed." };
      }
      await callbacks.step.onStepComplete(stepId, {
        output: rawText,
        promptSent: prompt,
        timeMs,
        inputTokens,
        outputTokens,
        model: MODEL,
        criticScore: parsed.score,
        criticFeedback: parsed.feedback,
      });
      return { score: parsed.score, feedback: parsed.feedback };
    } catch (err: any) {
      await callbacks.step.onStepError(stepId, err?.message ?? String(err));
      throw err;
    }
  }

  return { researchNode, analysisNode, writeNode, criticNode };
}
