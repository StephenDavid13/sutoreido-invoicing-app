import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        // NOTE: this tracks `routes.api` in src/payload.config.ts. The stock
        // Payload template says `/api/media/file/**`; we serve Payload from
        // /payload-api so that /api stays ours (PDF downloads, webhooks).
        pathname: '/payload-api/media/file/**',
      },
    ],
  },

  // @react-pdf/renderer depends on Yoga (WASM layout) and Node streams. Bundling
  // it breaks `__dirname` resolution under Turbopack/esbuild, so keep it external.
  // withPayload merges this array rather than replacing it.
  serverExternalPackages: ['@react-pdf/renderer'],

  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },

  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
