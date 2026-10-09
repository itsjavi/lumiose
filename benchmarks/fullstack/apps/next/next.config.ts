import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // doc-4 §1: HTTP compression is off in every app; payload sizes are measured offline.
  compress: false,
  poweredByHeader: false,
  // Keep `next dev` from writing AGENTS.md into the app (a dev-time side effect, not part of the app).
  agentRules: false,
  // Type checking is measured separately (`typecheck` script), not inside the timed build.
  typescript: { ignoreBuildErrors: true },
  // The shared workspace packages ship TypeScript sources.
  transpilePackages: ["@bench/data", "@bench/react-ui", "@bench/ui-css"],
};

export default nextConfig;
