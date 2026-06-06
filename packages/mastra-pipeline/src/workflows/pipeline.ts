import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { PipelineCallbacks } from "shared/src/types";
import { researcherAgent } from "../agents/researcher";
import { analystAgent } from "../agents/analyst";
import { writerAgent } from "../agents/writer";
import { criticAgent } from "../agents/critic";
import { lastTavilyCapture, resetTavilyCapture } from "../tools/search";

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

export async function runMastraPipeline(
  topic: string,
  callbacks: PipelineCallbacks
): Promise<void> {
  const pipelineResultId = await callbacks.onPipelineStart();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const pipelineStart = Date.now();

  const researchStep = createStep({
    id: "research",
    inputSchema: z.object({ topic: z.string() }),
    outputSchema: z.object({ topic: z.string(), research: z.string() }),
    execute: async ({ inputData }) => {
      const prompt = `Search the web for recent information about: ${inputData.topic}`;
      const stepId = await callbacks.step.onStepStart("research", 1, inputData.topic);
      const stepStart = Date.now();
      resetTavilyCapture();
      try {
        const result = await researcherAgent.generate(prompt);
        console.log("USAGE [research]:", JSON.stringify((result as any).usage));
        const timeMs = Date.now() - stepStart;
        const inputTokens =
          (result as any).usage?.promptTokens ??
          (result as any).usage?.inputTokens ??
          0;
        const outputTokens =
          (result as any).usage?.completionTokens ??
          (result as any).usage?.outputTokens ??
          0;
        totalInputTokens += inputTokens;
        totalOutputTokens += outputTokens;
        await callbacks.step.onStepComplete(stepId, {
          output: result.text,
          promptSent: prompt,
          timeMs,
          inputTokens,
          outputTokens,
          model: "claude-haiku-4-5",
          tavilyQuery: lastTavilyCapture?.query,
          tavilyResults: lastTavilyCapture
            ? JSON.stringify(lastTavilyCapture.results)
            : undefined,
        });
        return { topic: inputData.topic, research: result.text };
      } catch (err: any) {
        await callbacks.step.onStepError(stepId, err?.message ?? String(err));
        throw err;
      }
    },
  });

  const analysisStep = createStep({
    id: "analysis",
    inputSchema: z.object({ topic: z.string(), research: z.string() }),
    outputSchema: z.object({
      topic: z.string(),
      research: z.string(),
      analysis: z.string(),
      keyFindings: z.array(z.string()),
      mainThemes: z.array(z.string()),
      centralArgument: z.string(),
    }),
    execute: async ({ inputData }) => {
      const prompt = `Analyze the following research and extract insights:\n\n${inputData.research}`;
      const stepId = await callbacks.step.onStepStart(
        "analysis",
        1,
        inputData.research.slice(0, 500)
      );
      const stepStart = Date.now();
      try {
        const result = await analystAgent.generate(prompt);
        console.log("USAGE [analysis]:", JSON.stringify((result as any).usage));
        const timeMs = Date.now() - stepStart;
        const inputTokens =
          (result as any).usage?.promptTokens ??
          (result as any).usage?.inputTokens ??
          0;
        const outputTokens =
          (result as any).usage?.completionTokens ??
          (result as any).usage?.outputTokens ??
          0;
        totalInputTokens += inputTokens;
        totalOutputTokens += outputTokens;
        let parsed: { keyFindings: string[]; mainThemes: string[]; centralArgument: string };
        try {
          parsed = JSON.parse(result.text);
        } catch {
          parsed = {
            keyFindings: ["Unable to parse findings"],
            mainThemes: ["Unable to parse themes"],
            centralArgument: result.text.slice(0, 200),
          };
        }
        await callbacks.step.onStepComplete(stepId, {
          output: result.text,
          promptSent: prompt,
          timeMs,
          inputTokens,
          outputTokens,
          model: "claude-haiku-4-5",
        });
        return {
          topic: inputData.topic,
          research: inputData.research,
          analysis: result.text,
          keyFindings: parsed.keyFindings,
          mainThemes: parsed.mainThemes,
          centralArgument: parsed.centralArgument,
        };
      } catch (err: any) {
        await callbacks.step.onStepError(stepId, err?.message ?? String(err));
        throw err;
      }
    },
  });

  const writeCriticStep = createStep({
    id: "write-critic",
    inputSchema: z.object({
      topic: z.string(),
      research: z.string(),
      analysis: z.string(),
      keyFindings: z.array(z.string()),
      mainThemes: z.array(z.string()),
      centralArgument: z.string(),
      draft: z.string().optional(),
      score: z.number().optional(),
      feedback: z.string().optional(),
      iterations: z.number().optional(),
    }),
    outputSchema: z.object({
      topic: z.string(),
      research: z.string(),
      analysis: z.string(),
      keyFindings: z.array(z.string()),
      mainThemes: z.array(z.string()),
      centralArgument: z.string(),
      draft: z.string(),
      score: z.number(),
      feedback: z.string(),
      iterations: z.number(),
    }),
    execute: async ({ inputData }) => {
      const { keyFindings, mainThemes, centralArgument, research, analysis } = inputData;
      const iteration = (inputData.iterations ?? 0) + 1;

      // WRITE phase
      let writerPrompt = `Topic: "${inputData.topic}"

Research:
${research}

Analysis:
${analysis}`;
      if (inputData.feedback && inputData.draft) {
        writerPrompt += `\n\nPrevious draft:\n${inputData.draft}\n\nFeedback to address:\n${inputData.feedback}`;
      }

      const writeStepId = await callbacks.step.onStepStart(
        "write",
        iteration,
        writerPrompt.slice(0, 500)
      );
      const writeStart = Date.now();
      let draft = "";
      try {
        const writerResult = await writerAgent.generate(writerPrompt);
        console.log("USAGE [write]:", JSON.stringify((writerResult as any).usage));
        draft = writerResult.text;
        const writeTimeMs = Date.now() - writeStart;
        const wi =
          (writerResult as any).usage?.promptTokens ??
          (writerResult as any).usage?.inputTokens ??
          0;
        const wo =
          (writerResult as any).usage?.completionTokens ??
          (writerResult as any).usage?.outputTokens ??
          0;
        totalInputTokens += wi;
        totalOutputTokens += wo;
        await callbacks.step.onStepComplete(writeStepId, {
          output: draft,
          promptSent: writerPrompt,
          timeMs: writeTimeMs,
          inputTokens: wi,
          outputTokens: wo,
          model: "claude-haiku-4-5",
        });
      } catch (err: any) {
        await callbacks.step.onStepError(writeStepId, err?.message ?? String(err));
        throw err;
      }

      // CRITIC phase
      const criticPrompt = `RESEARCH:
${research}

ANALYSIS:
${analysis}

DRAFT:
${draft}

Evaluate the draft against the research and analysis above.`;
      console.log("=== CRITIC INPUT (first 300 chars) ===");
      console.log(criticPrompt.slice(0, 300));
      const criticStepId = await callbacks.step.onStepStart(
        "critic",
        iteration,
        draft.slice(0, 500)
      );
      const criticStart = Date.now();
      let criticScore = 4;
      let criticFeedback = "Score parsing failed — revising draft";
      let criticDimensions:
        | {
            fidelity: number;
            specificity: number;
            insight: number;
            fidelityReasoning: string;
            specificityReasoning: string;
            insightReasoning: string;
          }
        | undefined = undefined;
      try {
        const criticResult = await criticAgent.generate(criticPrompt);
        console.log("USAGE [critic]:", JSON.stringify((criticResult as any).usage));
        console.log("CRITIC RAW OUTPUT:", criticResult.text.slice(0, 500));
        const criticTimeMs = Date.now() - criticStart;
        const ci =
          (criticResult as any).usage?.promptTokens ??
          (criticResult as any).usage?.inputTokens ??
          0;
        const co =
          (criticResult as any).usage?.completionTokens ??
          (criticResult as any).usage?.outputTokens ??
          0;
        totalInputTokens += ci;
        totalOutputTokens += co;
        const parsed = extractJson(criticResult.text ?? "");
        if (!parsed) {
          console.log("CRITIC FULL OUTPUT (parse failed):", criticResult.text);
        }
        criticScore = parsed?.score ?? parsed?.finalScore ?? 4;
        criticFeedback = parsed?.feedback ?? "Score parsing failed — revising draft";
        if (parsed) {
          criticDimensions = {
            fidelity: parsed.fidelity ?? 0,
            specificity: parsed.specificity ?? 0,
            insight: parsed.insight ?? 0,
            fidelityReasoning: parsed.fidelityReasoning ?? "",
            specificityReasoning: parsed.specificityReasoning ?? "",
            insightReasoning: parsed.insightReasoning ?? "",
          };
        }
        await callbacks.step.onStepComplete(criticStepId, {
          output: criticResult.text,
          promptSent: criticPrompt,
          timeMs: criticTimeMs,
          inputTokens: ci,
          outputTokens: co,
          model: "claude-haiku-4-5",
          criticScore,
          criticFeedback,
          criticDimensions,
        });
      } catch (err: any) {
        await callbacks.step.onStepError(criticStepId, err?.message ?? String(err));
        throw err;
      }

      return {
        topic: inputData.topic,
        research,
        analysis,
        keyFindings,
        mainThemes,
        centralArgument,
        draft,
        score: criticScore,
        feedback: criticFeedback,
        iterations: iteration,
      };
    },
  });

  const workflow = createWorkflow({
    id: `research-pipeline-${Date.now()}`,
    inputSchema: z.object({ topic: z.string() }),
    outputSchema: z.object({
      topic: z.string(),
      draft: z.string(),
      score: z.number(),
      feedback: z.string(),
      iterations: z.number(),
    }),
  })
    .then(researchStep)
    .then(analysisStep)
    .dowhile(
      writeCriticStep,
      async ({ inputData }) => inputData.score < 7 && inputData.iterations < 3
    )
    .commit();

  try {
    const run = await workflow.createRun();
    const result = await run.start({ inputData: { topic } });

    if (result.status !== "success") {
      const errMsg = (result as any).error?.message ?? result.status;
      await callbacks.onPipelineError(pipelineResultId, errMsg);
      throw new Error(`Mastra pipeline failed: ${errMsg}`);
    }

    const output = result.result as {
      draft: string;
      score: number;
      iterations: number;
    };

    await callbacks.onPipelineComplete(pipelineResultId, {
      iterations: output.iterations,
      finalScore: output.score,
      finalReport: output.draft,
      totalTimeMs: Date.now() - pipelineStart,
      totalInputTokens,
      totalOutputTokens,
    });
  } catch (err: any) {
    if (!err?.message?.startsWith("Mastra pipeline failed")) {
      await callbacks.onPipelineError(pipelineResultId, err?.message ?? String(err));
    }
    throw err;
  }
}
