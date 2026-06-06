import { StateGraph, START, END } from "@langchain/langgraph";
import { PipelineState, PipelineStateType } from "./state";
import { researchNode, analysisNode, writeNode, criticNode } from "./nodes";

function shouldRevise(state: PipelineStateType): string {
  if (state.score >= 7 || state.iterations >= 3) return "end";
  return "revise";
}

export const pipeline = new StateGraph(PipelineState)
  .addNode("researcher", researchNode)
  .addNode("analyzer", analysisNode)
  .addNode("write", writeNode)
  .addNode("critic", criticNode)
  .addEdge(START, "researcher")
  .addEdge("researcher", "analyzer")
  .addEdge("analyzer", "write")
  .addEdge("write", "critic")
  .addConditionalEdges("critic", shouldRevise, {
    revise: "write",
    end: END,
  })
  .compile();
