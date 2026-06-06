import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  runs: defineTable({
    topic: v.string(),
    category: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("complete"),
      v.literal("error")
    ),
  }).index("by_category", ["category"]),

  pipelineResults: defineTable({
    runId: v.id("runs"),
    framework: v.union(v.literal("mastra"), v.literal("langchain")),
    status: v.union(
      v.literal("running"),
      v.literal("complete"),
      v.literal("error")
    ),
    iterations: v.number(),
    finalScore: v.optional(v.number()),
    finalReport: v.optional(v.string()),
    totalTimeMs: v.optional(v.number()),
    totalInputTokens: v.optional(v.number()),
    totalOutputTokens: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    logs: v.optional(
      v.array(
        v.object({
          timestamp: v.number(),
          tag: v.string(),
          message: v.string(),
        })
      )
    ),
  }).index("by_run", ["runId"]),

  steps: defineTable({
    runId: v.id("runs"),
    pipelineResultId: v.id("pipelineResults"),
    framework: v.union(v.literal("mastra"), v.literal("langchain")),
    stepName: v.union(
      v.literal("research"),
      v.literal("analysis"),
      v.literal("write"),
      v.literal("critic")
    ),
    iterationNumber: v.number(),
    status: v.union(
      v.literal("running"),
      v.literal("complete"),
      v.literal("error")
    ),
    input: v.optional(v.string()),
    output: v.optional(v.string()),
    promptSent: v.optional(v.string()),
    timeMs: v.optional(v.number()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    model: v.optional(v.string()),
    tavilyQuery: v.optional(v.string()),
    tavilyResults: v.optional(v.string()),
    criticScore: v.optional(v.number()),
    criticFeedback: v.optional(v.string()),
    criticDimensions: v.optional(v.object({
      fidelity: v.number(),
      specificity: v.number(),
      insight: v.number(),
      fidelityReasoning: v.string(),
      specificityReasoning: v.string(),
      insightReasoning: v.string(),
    })),
    errorMessage: v.optional(v.string()),
  }).index("by_pipeline_result", ["pipelineResultId"]),
});
