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

  const { pipeline } = await import("./graph/pipeline");

  console.log("=== LANGCHAIN PIPELINE ===");
  console.log(`Topic: ${topic}`);
  console.log("Running pipeline...\n");

  const result = await pipeline.invoke({ topic, iterations: 0 });

  console.log(`Iterations: ${result.iterations}`);
  console.log(`Score: ${result.score}/10`);
  console.log("\n--- FINAL REPORT ---");
  console.log(result.draft);
  console.log("====================");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
