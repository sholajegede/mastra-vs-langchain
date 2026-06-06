import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { researcherAgent } from "../agents/researcher";
import { analystAgent } from "../agents/analyst";
import { writerAgent } from "../agents/writer";
import { criticAgent } from "../agents/critic";

const researchStep = createStep({
  id: "research",
  inputSchema: z.object({ topic: z.string() }),
  outputSchema: z.object({ topic: z.string(), research: z.string() }),
  execute: async ({ inputData }) => {
    const result = await researcherAgent.generate(
      `Search the web for recent information about: ${inputData.topic}`
    );
    return { topic: inputData.topic, research: result.text };
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
    const result = await analystAgent.generate(
      `Analyze the following research and extract insights:\n\n${inputData.research}`
    );
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
    return {
      topic: inputData.topic,
      keyFindings: parsed.keyFindings,
      mainThemes: parsed.mainThemes,
      centralArgument: parsed.centralArgument,
    };
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
    const feedback = inputData.feedback;
    const prevDraft = inputData.draft;
    const iterations = inputData.iterations ?? 0;

    let writerPrompt = `Write a structured ~400-word report on the topic: "${inputData.topic}"

Analysis data:
- Key Findings: ${keyFindings.join(" | ")}
- Main Themes: ${mainThemes.join(", ")}
- Central Argument: ${centralArgument}`;

    if (feedback && prevDraft) {
      writerPrompt += `\n\nPrevious draft to revise:\n${prevDraft}\n\nFeedback to address:\n${feedback}`;
    }

    const writerResult = await writerAgent.generate(writerPrompt);
    const draft = writerResult.text;

    const criticResult = await criticAgent.generate(
      `Review and score the following report on accuracy, clarity, and depth:\n\n${draft}`
    );

    let criticData: { score: number; feedback: string };
    try {
      criticData = JSON.parse(criticResult.text);
    } catch {
      criticData = { score: 7, feedback: "Score parsing failed; defaulting to acceptable." };
    }

    return {
      topic: inputData.topic,
      keyFindings,
      mainThemes,
      centralArgument,
      draft,
      score: criticData.score,
      feedback: criticData.feedback,
      iterations: iterations + 1,
    };
  },
});

export const pipeline = createWorkflow({
  id: "research-pipeline",
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
