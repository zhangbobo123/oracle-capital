import type { NextConfig } from "next";

const isGitHubActions = process.env.STATIC_EXPORT === "true";
const basePath = isGitHubActions ? "/oracle-capital" : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
