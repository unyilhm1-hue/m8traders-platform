import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // 🚀 PERFORMANCE FIX: Ignore large data folders from file-watcher
  // Turbopack config (Next.js 16+ default)
  turbopack: {
    // Turbopack doesn't need explicit file watching config
    // It's smart enough to ignore large unchanged folders
  },

  // Webpack config (fallback for --webpack mode)
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
