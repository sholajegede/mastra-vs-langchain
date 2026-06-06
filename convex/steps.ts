import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createStep = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("steps", {
      runId: args.runId,
      pipelineResultId: args.pipelineResultId,
      framework: args.framework,
      stepName: args.stepName,
      iterationNumber: args.iterationNumber,
      status: args.status,
      input: args.input,
    });
  },
});

export const updateStep = mutation({
  args: {
    id: v.id("steps"),
    status: v.optional(
      v.union(
        v.literal("running"),
        v.literal("complete"),
        v.literal("error")
      )
    ),
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
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const update = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, update);
  },
});

export const getStepsForPipelineResult = query({
  args: { pipelineResultId: v.id("pipelineResults") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("steps")
      .withIndex("by_pipeline_result", (q) =>
        q.eq("pipelineResultId", args.pipelineResultId)
      )
      .collect();
  },
});
