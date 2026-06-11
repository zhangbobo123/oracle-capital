import type { NextConfig } from "next";

const isGitHubActions = process.env.STATIC_EXPORT === "true";
const basePath = isGitHubActions ? "/oracle-capital" : "";

const nextConfig: NextConfig = {
  ...(isGitHubActions ? { output: "export" as const } : {}),
  basePath,
  assetPrefix: basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
