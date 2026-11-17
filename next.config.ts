import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  basePath: process.env.KTRAVEL_BASE_PATH || '',
};

export default nextConfig;
