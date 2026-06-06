import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { PipelineCallbacks } from "shared/src/types";
import { researcherAgent } from "../agents/researcher";
import { analystAgent } from "../agents/analyst";
import { writerAgent } from "../agents/writer";
import { criticAgent } from "../agents/critic";
import { lastTavilyCapture, resetTavilyCapture } from "../tools/search";

export async function runMastraPipeline(
  topic: string,
  callbacks: PipelineCallbacks
): Promise<void> {
  const pipelineResultId = await callbacks.onPipelineStart();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const pipelineStart = Date.now();

  // Steps are created inside this function to close over callbacks + accumulators

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
      keyFindings: z.array(z.string()),
      mainThemes: z.array(z.string()),
      centralArgument: z.string(),
      draft: z.string(),
      score: z.number(),
      feedback: z.string(),
      iterations: z.number(),
    }),
    execute: async ({ inputData }) => {
      const { keyFindings, mainThemes, centralArgument } = inputData;
      const iteration = (inputData.iterations ?? 0) + 1;

      // WRITE phase
      let writerPrompt = `Write a structured ~400-word report on the topic: "${inputData.topic}"

Analysis data:
- Key Findings: ${keyFindings.join(" | ")}
- Main Themes: ${mainThemes.join(", ")}
- Central Argument: ${centralArgument}`;
      if (inputData.feedback && inputData.draft) {
        writerPrompt += `\n\nPrevious draft to revise:\n${inputData.draft}\n\nFeedback to address:\n${inputData.feedback}`;
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
      const criticPrompt = `Review and score the following report on accuracy, clarity, and depth:\n\n${draft}`;
      const criticStepId = await callbacks.step.onStepStart(
        "critic",
        iteration,
        draft.slice(0, 500)
      );
      const criticStart = Date.now();
      let criticData: { score: number; feedback: string } = { score: 7, feedback: "" };
      try {
        const criticResult = await criticAgent.generate(criticPrompt);
        console.log("USAGE [critic]:", JSON.stringify((criticResult as any).usage));
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
        try {
          criticData = JSON.parse(criticResult.text);
        } catch {
          criticData = { score: 7, feedback: "Score parsing failed." };
        }
        await callbacks.step.onStepComplete(criticStepId, {
          output: criticResult.text,
          promptSent: criticPrompt,
          timeMs: criticTimeMs,
          inputTokens: ci,
          outputTokens: co,
          model: "claude-haiku-4-5",
          criticScore: criticData.score,
          criticFeedback: criticData.feedback,
        });
      } catch (err: any) {
        await callbacks.step.onStepError(criticStepId, err?.message ?? String(err));
        throw err;
      }

      return {
        topic: inputData.topic,
        keyFindings,
        mainThemes,
        centralArgument,
        draft,
        score: criticData.score,
        feedback: criticData.feedback,
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
