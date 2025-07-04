/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Only run ESLint in development and during explicit lint commands
    ignoreDuringBuilds: false,
    dirs: ['app', 'components', 'lib', 'hooks']
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: config => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': '.',
    }
    return config
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
