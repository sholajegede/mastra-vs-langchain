import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY is not set in .env");
    process.exit(1);
  }
  if (!process.env.TAVILY_API_KEY) {
    console.error("Error: TAVILY_API_KEY is not set in .env");
    process.exit(1);
  }

  const topic = process.argv[2] ?? "the future of multi-agent AI systems";

  const { runMastraPipeline } = await import("./workflows/pipeline");

  const noopCallbacks = {
    onPipelineStart: async () => "noop",
    onPipelineComplete: async () => {},
    onPipelineError: async () => {},
    step: {
      onStepStart: async () => "noop",
      onStepComplete: async () => {},
      onStepError: async () => {},
    },
  };

  console.log("=== MASTRA PIPELINE ===");
  console.log(`Topic: ${topic}`);
  console.log("Running pipeline...\n");

  let finalReport = "";
  let finalScore = 0;
  let finalIterations = 0;

  const callbacks = {
    ...noopCallbacks,
    onPipelineComplete: async (_id: string, data: {
      iterations: number; finalScore: number; finalReport: string;
      totalTimeMs: number; totalInputTokens: number; totalOutputTokens: number;
    }) => {
      finalReport = data.finalReport;
      finalScore = data.finalScore;
      finalIterations = data.iterations;
    },
  };

  await runMastraPipeline(topic, callbacks);

  console.log(`Iterations: ${finalIterations}`);
  console.log(`Score: ${finalScore}/10`);
  console.log("\n--- FINAL REPORT ---");
  console.log(finalReport);
  console.log("====================");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
