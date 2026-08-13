import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin file tracing to the monorepo root (apps/web/../..).
  //
  // Next infers this by walking up for a lockfile, and there is an unrelated
  // package-lock.json in the parent of this repo — so it was selecting a
  // directory OUTSIDE the project and warning about it on every build. Left
  // inferred, the traced file set depends on what happens to sit above the
  // checkout, which differs between a dev machine and CI.
  outputFileTracingRoot: join(__dirname, '../..'),

  // Workspace packages ship raw TS source (Turborepo just-in-time style);
  // Next transpiles them as part of this app's build.
  transpilePackages: ['@pawplate/core', '@pawplate/ui'],
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
