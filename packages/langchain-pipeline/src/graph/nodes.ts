import { ChatAnthropic } from "@langchain/anthropic";
import { tavily } from "@tavily/core";
import { z } from "zod";
import { PipelineCallbacks } from "shared/src/types";
import { PipelineStateType } from "./state";

const MODEL = "claude-haiku-4-5";

function makeLLM() {
  return new ChatAnthropic({ model: MODEL });
}

async function retryOnFetch<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const shouldRetry =
        e?.message?.includes("fetch") ||
        e?.message?.includes("fetch failed") ||
        e?.message === "fetch failed" ||
        e?.message?.includes("SSL") ||
        e?.message?.includes("ECONNRESET") ||
        e?.message?.includes("other side closed") ||
        e?.cause?.message?.includes("fetch") ||
        e?.cause?.code === "ECONNRESET";
      if (i < retries && shouldRetry) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error("unreachable");
}

const WRITER_INSTRUCTIONS = `You are a research analyst writing for a technical audience. Your job is to produce a report that makes specific, defensible claims grounded in the research provided to you.

STRICT REQUIREMENTS:
- Your opening sentence must state a specific finding from the research, not a general observation. Never open with "X is increasingly important" or "The landscape of X has changed significantly."
- Every paragraph makes exactly one argument. State it in the first sentence. Use the remaining sentences to support it with specific evidence from the research.
- Name specific tools, frameworks, companies, numbers, and dates when the research contains them. Do not paraphrase them into vague generalities.
- Your conclusion must make a specific recommendation or prediction that follows from the evidence. It must not restate the introduction.
- Target length: 350-450 words. Not a word longer than needed.

FORBIDDEN PHRASES — using any of these results in a failed evaluation:
- "it is important to note"
- "it is worth noting"
- "organizations must consider"
- "in conclusion" or "in summary"
- "as we look to the future"
- "rapidly evolving landscape"
- "it goes without saying"
- "needless to say"
- "at the end of the day"
- Any sentence that would be equally true if you replaced the topic with a different topic

Structure:
1. Opening paragraph: your single strongest specific finding, stated as a direct claim
2. Three body paragraphs: one argument each, each grounded in specific research findings
3. Closing paragraph: a specific recommendation or prediction, not a summary`;

const CRITIC_INSTRUCTIONS = `You are a senior research editor with one job: catch the specific ways that AI-generated reports fail. You evaluate reports against the original search results that informed them.

You score three dimensions independently using chain-of-thought reasoning. You MUST complete all reasoning steps before assigning any score.

---

STEP 1 — CLAIM AUDIT
List every factual claim in the DRAFT. For each claim, classify it as one of:
[GROUNDED] supported by a specific result in RESEARCH
[INFERRED] reasonable extension of the research
[UNSUPPORTED] not in the research, no clear basis
[HALLUCINATED] contradicts or fabricates details

STEP 2 — SPECIFICITY AUDIT
List every sentence in the DRAFT that matches one or more of these patterns:
- Contains a forbidden phrase (see below)
- Is a generic observation true of any topic
- Is a restatement of another sentence in the report
- Makes no claim that could be false

Forbidden phrases that auto-penalise: "it is important to note", "organizations must consider", "rapidly evolving", "as we look to the future", "needless to say", any sentence that would be equally true if the topic were replaced.

STEP 3 — INSIGHT AUDIT
Does the conclusion add anything not in the introduction? Does the report make a non-obvious connection between findings? Would a developer reading this learn something they could not have inferred from the topic title alone?

STEP 4 — SCORE EACH DIMENSION

SOURCE FIDELITY (how grounded is the report in the actual research results?):
1-2: Multiple HALLUCINATED or heavily UNSUPPORTED claims
3-4: Several UNSUPPORTED claims that stretch the research
5-6: Mostly INFERRED with few GROUNDED specifics
7-8: Majority GROUNDED, only minor inference
9-10: Every major claim is GROUNDED, zero hallucination

SPECIFICITY (does it make specific falsifiable claims?):
1-2: Reads like a generic essay on the topic
3-4: A few specifics surrounded by filler
5-6: Mix — some paragraphs specific, others generic
7-8: Mostly specific, one or two generic sentences
9-10: Every sentence makes a specific, falsifiable claim

INSIGHT (does it say something worth reading?):
1-2: Restates the obvious, no synthesis
3-4: Identifies patterns already implicit in the topic
5-6: Some synthesis but conclusions do not surprise
7-8: Makes a non-obvious connection or recommendation
9-10: A reader learns something they could not have inferred

STEP 5 — CALCULATE FINAL SCORE
finalScore = round((fidelity * 0.40) + (specificity * 0.30) + (insight * 0.30))

A score of 7 means the report is genuinely good. Most first drafts should score 4-6. Reserve 8-10 for reports that are specific, grounded, and insightful.

---

Respond ONLY with this JSON (no markdown, no extra text):
{
  "fidelity": <1-10>,
  "fidelityReasoning": "<one sentence explaining the score>",
  "specificity": <1-10>,
  "specificityReasoning": "<one sentence explaining the score>",
  "insight": <1-10>,
  "insightReasoning": "<one sentence explaining the score>",
  "score": <weighted final 1-10>,
  "feedback": "<two to three sentences: what specifically needs to improve in the next draft, referencing actual sentences>"
}`;

const criticOutputSchema = z.object({
  fidelity: z.number(),
  fidelityReasoning: z.string(),
  specificity: z.number(),
  specificityReasoning: z.string(),
  insight: z.number(),
  insightReasoning: z.string(),
  score: z.number(),
  feedback: z.string(),
});

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
    let prompt = `${WRITER_INSTRUCTIONS}

Topic: "${state.topic}"

Analysis:
${state.analysis}

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

  async function criticNode(
    state: PipelineStateType
  ): Promise<Partial<PipelineStateType>> {
    const llm = makeLLM();
    const iteration = state.iterations ?? 1;
    const prompt = `${CRITIC_INSTRUCTIONS}

RESEARCH:
${state.research}

ANALYSIS:
${state.analysis}

DRAFT:
${state.draft}

Evaluate the draft against the research and analysis above.`;
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
      let parsed: z.infer<typeof criticOutputSchema>;
      try {
        parsed = criticOutputSchema.parse(JSON.parse(rawText));
      } catch {
        parsed = {
          fidelity: 5,
          fidelityReasoning: "Score parsing failed.",
          specificity: 5,
          specificityReasoning: "Score parsing failed.",
          insight: 5,
          insightReasoning: "Score parsing failed.",
          score: 5,
          feedback: "Score parsing failed.",
        };
      }
      const criticDimensions = {
        fidelity: parsed.fidelity,
        specificity: parsed.specificity,
        insight: parsed.insight,
        fidelityReasoning: parsed.fidelityReasoning,
        specificityReasoning: parsed.specificityReasoning,
        insightReasoning: parsed.insightReasoning,
      };
      await callbacks.step.onStepComplete(stepId, {
        output: rawText,
        promptSent: prompt,
        timeMs,
        inputTokens,
        outputTokens,
        model: MODEL,
        criticScore: parsed.score,
        criticFeedback: parsed.feedback,
        criticDimensions,
      });
      return { score: parsed.score, feedback: parsed.feedback, criticDimensions };
    } catch (err: any) {
      await callbacks.step.onStepError(stepId, err?.message ?? String(err));
      throw err;
    }
  }

  return { researchNode, analysisNode, writeNode, criticNode };
}
