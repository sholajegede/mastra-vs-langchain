import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createPipelineResult = mutation({
  args: {
    runId: v.id("runs"),
    framework: v.union(v.literal("mastra"), v.literal("langchain")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("pipelineResults", {
      runId: args.runId,
      framework: args.framework,
      status: "running",
      iterations: 0,
    });
  },
});

export const updatePipelineResult = mutation({
  args: {
    id: v.id("pipelineResults"),
    status: v.optional(
      v.union(
        v.literal("running"),
        v.literal("complete"),
        v.literal("error")
      )
    ),
    iterations: v.optional(v.number()),
    finalScore: v.optional(v.number()),
    finalReport: v.optional(v.string()),
    totalTimeMs: v.optional(v.number()),
    totalInputTokens: v.optional(v.number()),
    totalOutputTokens: v.optional(v.number()),
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

export const getPipelineResultsForRun = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pipelineResults")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
  },
});
