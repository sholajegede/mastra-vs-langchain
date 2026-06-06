import { Annotation } from "@langchain/langgraph";

export const PipelineState = Annotation.Root({
  topic: Annotation<string>(),
  research: Annotation<string>(),
  analysis: Annotation<string>(),
  draft: Annotation<string>(),
  score: Annotation<number>(),
  feedback: Annotation<string>(),
  iterations: Annotation<number>(),
  finalReport: Annotation<string>(),
});

export type PipelineStateType = typeof PipelineState.State;
