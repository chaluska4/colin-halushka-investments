/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Improve dev server stability
  onDemandEntries: {
    // Keep pages in memory longer to reduce recompilation
    maxInactiveAge: 120 * 1000,
    // Number of pages to keep in memory
    pagesBufferLength: 8,
  },

  // Webpack configuration for stable chunk IDs
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Use deterministic IDs in development to prevent missing module errors
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        chunkIds: 'deterministic',
        // Prevent aggressive chunk splitting that can cause instability
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            // Ensure stable chunk grouping
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
          },
        },
      };

      // Improve module resolution stability
      config.resolve = {
        ...config.resolve,
        // Ensure consistent module resolution
        symlinks: true,
      };

      // Snapshot configuration for better cache stability
      config.snapshot = {
        ...config.snapshot,
        managedPaths: [/^(.+?[\\/]node_modules[\\/])/],
      };
    }

    return config;
  },

  // Disable experimental features that can cause instability
  experimental: {
    // Ensure stable server actions
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
