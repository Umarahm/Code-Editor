import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    config.resolve.alias['swr'] = path.resolve(__dirname, 'node_modules/swr');
    return config;
  },
};

export default nextConfig;
