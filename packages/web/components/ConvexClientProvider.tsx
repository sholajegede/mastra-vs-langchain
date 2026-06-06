"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

let convex: ConvexReactClient | null = null;

if (process.env.NEXT_PUBLIC_CONVEX_URL) {
  convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL);
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) return <>{children}</>;
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
