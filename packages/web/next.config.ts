import type { NextConfig } from "next";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
    TAVILY_API_KEY: process.env.TAVILY_API_KEY ?? "",
  },
  serverExternalPackages: [
    "@mastra/core",
    "@ai-sdk/anthropic",
    "@tavily/core",
    "@langchain/anthropic",
    "@langchain/langgraph",
    "@langchain/community",
    "@langchain/core",
  ],
};

export default nextConfig;
