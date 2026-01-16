import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // 🚀 PERFORMANCE FIX: Ignore large data folders from file-watcher
  // Prevents slow Fast Refresh caused by watching 1000+ JSON files
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/public/simulation-data/**',  // ← Ignore large data folder
          '**/.git/**',
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
