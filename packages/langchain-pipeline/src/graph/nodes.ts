import { ChatAnthropic } from "@langchain/anthropic";
import { tavily } from "@tavily/core";
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

function extractJson(text: string): any {
  try {
    return JSON.parse(text.trim());
  } catch {}

  const matches = text.match(/\{[\s\S]*\}/g);
  if (matches) {
    for (let i = matches.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(matches[i]);
      } catch {}
    }
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {}
  }

  return null;
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

STEP 3.5 — COUNTERFACTUAL CHECK
What would a reader believe after reading this report that they would not have believed from just the topic title and general knowledge?

List at least one specific belief change. If you cannot identify one, the insight score cannot exceed 6.

STEP 4 — SCORE EACH DIMENSION

SOURCE FIDELITY (how grounded in the actual research?):
1-2:  Multiple claims contradict or fabricate details not present in the research
3-4:  Several claims go beyond the research with no basis
5-6:  Claims are accurate but traced to general topic knowledge, not these specific search results
7:    Most claims traceable to the research, at least one source cited by name
8:    All major claims grounded, two or more named sources with specific details used
9-10: Every claim traces to a named source, at least one specific statistic or quote used from the research, zero unsupported claims

SPECIFICITY (specific falsifiable claims?):
1-2:  Generic throughout — could be about any topic
3-4:  One or two specific details buried in filler
5-6:  Some specific claims but generic analysis or generic transitions between paragraphs
7:    Mostly specific, minor filler remains
8:    Every paragraph makes a specific claim that could be falsified, named entities used throughout
9-10: Zero sentences that would survive if you swapped the topic. Every claim is tied to this specific topic with this specific evidence.

INSIGHT (worth reading?):
1-2:  Restates what the topic title implies
3-4:  Identifies patterns obvious from the topic
5-6:  Some synthesis but the conclusion could have been written before reading the research
7:    The conclusion makes a recommendation or prediction that follows from the evidence
8:    Identifies a tension or tradeoff the reader likely has not considered
9-10: A senior engineer would reconsider an architectural decision after reading this. The insight is non-obvious AND actionable.

STEP 5 — CALCULATE FINAL SCORE
finalScore = round((fidelity * 0.40) + (specificity * 0.30) + (insight * 0.30))

FLOOR RULE: If any single dimension scores 4 or below, the final score cannot exceed 6 regardless of the weighted calculation. A critical failure in one dimension cannot be averaged away.

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
  "feedback": "<Two to three sentences. Be surgical — identify the exact sentence or paragraph that caused the lowest-scoring dimension to fail, quote it, and state precisely what needs to change. Generic feedback like 'improve source citations' is not acceptable.>"
}`;

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
    const prompt = `You are a research analyst writing for a technical audience.

RESEARCH (raw search results — cite specific sources by name):
${state.research}

ANALYSIS:
${state.analysis}
${state.feedback ? `\nCRITIC FEEDBACK FROM PREVIOUS DRAFT:\n${state.feedback}` : ""}

${WRITER_INSTRUCTIONS}

Return ONLY the report text, no extra commentary.`;
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
    console.log("=== CRITIC INPUT (first 300 chars) ===");
    console.log(prompt.slice(0, 300));
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
      const rawText =
        typeof response.content === "string"
          ? response.content
          : (response.content as any)[0]?.text ?? "";
      console.log("LANGCHAIN CRITIC RAW:", rawText.slice(0, 500));
      const parsed = extractJson(rawText);
      if (!parsed) {
        console.log("LANGCHAIN CRITIC FULL OUTPUT (parse failed):", rawText);
      }
      const criticScore = parsed?.score ?? parsed?.finalScore ?? 4;
      const criticFeedback =
        parsed?.feedback ?? "Score parsing failed — revising draft";
      const criticDimensions = parsed
        ? {
            fidelity: parsed.fidelity ?? 0,
            specificity: parsed.specificity ?? 0,
            insight: parsed.insight ?? 0,
            fidelityReasoning: parsed.fidelityReasoning ?? "",
            specificityReasoning: parsed.specificityReasoning ?? "",
            insightReasoning: parsed.insightReasoning ?? "",
          }
        : undefined;
      await callbacks.step.onStepComplete(stepId, {
        output: rawText,
        promptSent: prompt,
        timeMs,
        inputTokens,
        outputTokens,
        model: MODEL,
        criticScore,
        criticFeedback,
        criticDimensions,
      });
      return {
        score: criticScore,
        feedback: criticFeedback,
        criticDimensions: criticDimensions ?? {},
      };
    } catch (err: any) {
      await callbacks.step.onStepError(stepId, err?.message ?? String(err));
      throw err;
    }
  }

  return { researchNode, analysisNode, writeNode, criticNode };
}
