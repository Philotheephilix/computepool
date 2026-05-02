import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // /infer/active fires a one-shot SSE that is genuinely hard to make
  // idempotent under React 19 dev strict-mode (mount → cleanup → mount
  // races the x402 settlement of the first attempt against the second).
  // Disable strict mode so the single signed authorization can complete
  // before the next attempt is fired.
  reactStrictMode: false,
};

export default nextConfig;
