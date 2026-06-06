export interface StepCallbacks {
  onStepStart: (
    stepName: string,
    iterationNumber: number,
    input: string
  ) => Promise<string>; // returns stepId
  onStepComplete: (
    stepId: string,
    data: {
      output: string;
      promptSent: string;
      timeMs: number;
      inputTokens: number;
      outputTokens: number;
      model: string;
      tavilyQuery?: string;
      tavilyResults?: string;
      criticScore?: number;
      criticFeedback?: string;
      criticDimensions?: {
        fidelity: number;
        specificity: number;
        insight: number;
        fidelityReasoning: string;
        specificityReasoning: string;
        insightReasoning: string;
      };
    }
  ) => Promise<void>;
  onStepError: (stepId: string, error: string) => Promise<void>;
}

export interface PipelineCallbacks {
  onPipelineStart: () => Promise<string>; // returns pipelineResultId
  onPipelineComplete: (
    pipelineResultId: string,
    data: {
      iterations: number;
      finalScore: number;
      finalReport: string;
      totalTimeMs: number;
      totalInputTokens: number;
      totalOutputTokens: number;
    }
  ) => Promise<void>;
  onPipelineError: (
    pipelineResultId: string,
    error: string
  ) => Promise<void>;
  step: StepCallbacks;
  pipelineResultId?: string;
}
