import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Vercel packages Next.js output itself. Standalone output remains enabled
  // for the repository's self-hosted Docker image.
  output: process.env.VERCEL === '1' ? undefined : 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
