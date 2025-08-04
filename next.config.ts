import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/plate-designer',
  assetPrefix: '/plate-designer',
  images: {
    unoptimized: true, 
  },

}

export default nextConfig;
