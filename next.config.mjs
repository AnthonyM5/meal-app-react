/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: true,
  },
  // Add service worker support
  async rewrites() {
    return [
      {
        source: '/sw.js',
        destination: '/app/sw.ts',
      },
    ]
  },
}

export default nextConfig
