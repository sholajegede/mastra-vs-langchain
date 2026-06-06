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

  const { pipeline } = await import("./workflows/pipeline");

  console.log("=== MASTRA PIPELINE ===");
  console.log(`Topic: ${topic}`);
  console.log("Running pipeline...\n");

  const run = await pipeline.createRun();
  const result = await run.start({ inputData: { topic } });

  if (result.status !== "success") {
    const err = (result as any).error;
    console.error("Pipeline failed:", err?.message ?? result.status);
    process.exit(1);
  }

  const output = result.result as {
    topic: string;
    draft: string;
    score: number;
    feedback: string;
    iterations: number;
  };

  console.log(`Iterations: ${output.iterations}`);
  console.log(`Score: ${output.score}/10`);
  console.log("\n--- FINAL REPORT ---");
  console.log(output.draft);
  console.log("====================");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
