import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createRun = mutation({
  args: { topic: v.string(), category: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("runs", {
      topic: args.topic,
      category: args.category,
      status: "running",
    });
  },
});

export const updateRunStatus = mutation({
  args: {
    runId: v.id("runs"),
    status: v.union(
      v.literal("running"),
      v.literal("complete"),
      v.literal("error")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, { status: args.status });
  },
});

export const getRun = query({
  args: { runId: v.id("runs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId);
  },
});

export const listRuns = query({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const runs =
      args.category && args.category !== "All"
        ? await ctx.db
            .query("runs")
            .withIndex("by_category", (q) => q.eq("category", args.category!))
            .order("desc")
            .collect()
        : await ctx.db.query("runs").order("desc").collect();

    return await Promise.all(
      runs.map(async (run) => {
        const pipelineResults = await ctx.db
          .query("pipelineResults")
          .withIndex("by_run", (q) => q.eq("runId", run._id))
          .collect();
        return { ...run, pipelineResults };
      })
    );
  },
});
