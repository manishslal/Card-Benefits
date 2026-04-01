/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Set to false if you want production builds to fail if there are type errors
    ignoreBuildErrors: false,
  },
  eslint: {
    // Disable ESLint during build (there's a circular dependency issue in ESLint config)
    // Run separately with: npm run lint
    ignoreDuringBuilds: true,
  },
  
  // Ensure CSS is extracted with consistent naming and handle native modules
  webpack: (config, { isServer }) => {
    // Handle native modules (like argon2) that should only be used on the server
    if (!isServer) {
      // Exclude native modules from client-side bundles
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'argon2': false,
        'crypto': false,
      };
    }

    // Mark argon2 as external (server-only)
    if (isServer) {
      config.externals = [...(config.externals || []), 'argon2'];
    }

    // Find the CSS rules in webpack config
    const cssRules = config.module.rules.find(
      rule => rule.test?.toString().includes('css')
    );

    if (cssRules && cssRules.use) {
      // Ensure CSS modules are extracted with predictable names
      cssRules.use.forEach(loader => {
        if (loader.loader?.includes('mini-css-extract-plugin')) {
          // Configure CSS extraction with consistent naming
          loader.options = loader.options || {};
          // Use contenthash to cache-bust but ensure manifest mapping is correct
          loader.options.filename = isServer
            ? '../static/css/[name].css'
            : 'static/css/[name].[contenthash].css';
          loader.options.chunkFilename = isServer
            ? '../static/css/[name].[contenthash].css'
            : 'static/css/[name].[contenthash].css';
          // Ignore unknown exports from CSS imports
          loader.options.ignoreOrder = true;
        }
      });
    }

    return config;
  },
  
  // Experimental optimizations for performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-*'],
  },
};

module.exports = nextConfig;
