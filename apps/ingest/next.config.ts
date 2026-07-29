import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Leave @jsquash/jpeg's require.resolve()'d .wasm file alone at build time —
  // without this, webpack tries to parse the binary as a JS module and fails.
  serverExternalPackages: ["@jsquash/jpeg"],
  // @jsquash/jpeg's .wasm binary is loaded via fs.readFileSync at runtime (see
  // packages/db/src/upload-avatar-raw.ts) rather than a static import, so Next's
  // tracer can miss it in a pnpm monorepo — after the sharp bundling issue, make
  // this explicit instead of hoping default tracing finds it.
  outputFileTracingIncludes: {
    "/api/inngest": ["../../node_modules/**/@jsquash/**/*.wasm"],
  },
};

export default nextConfig;
