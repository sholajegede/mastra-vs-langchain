import { StateGraph, START, END } from "@langchain/langgraph";
import { PipelineCallbacks } from "shared/src/types";
import { PipelineState, PipelineStateType } from "./state";
import { createNodes } from "./nodes";

function shouldRevise(state: PipelineStateType): string {
  if (state.score >= 7 || state.iterations >= 3) return "end";
  return "revise";
}

export async function runLangChainPipeline(
  topic: string,
  callbacks: PipelineCallbacks
): Promise<void> {
  const pipelineResultId = await callbacks.onPipelineStart();
  const acc = { inputTokens: 0, outputTokens: 0 };
  const pipelineStart = Date.now();

  const nodes = createNodes(callbacks, acc);

  const app = new StateGraph(PipelineState)
    .addNode("researcher", nodes.researchNode)
    .addNode("analyzer", nodes.analysisNode)
    .addNode("write", nodes.writeNode)
    .addNode("critic", nodes.criticNode)
    .addEdge(START, "researcher")
    .addEdge("researcher", "analyzer")
    .addEdge("analyzer", "write")
    .addEdge("write", "critic")
    .addConditionalEdges("critic", shouldRevise, {
      revise: "write",
      end: END,
    })
    .compile();

  try {
    const result = await app.invoke({ topic, iterations: 0 });
    await callbacks.onPipelineComplete(pipelineResultId, {
      iterations: result.iterations ?? 1,
      finalScore: result.score ?? 0,
      finalReport: result.draft ?? "",
      totalTimeMs: Date.now() - pipelineStart,
      totalInputTokens: acc.inputTokens,
      totalOutputTokens: acc.outputTokens,
    });
  } catch (err: any) {
    await callbacks.onPipelineError(pipelineResultId, err?.message ?? String(err));
    throw err;
  }
}
