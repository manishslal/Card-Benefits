/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Set to false if you want production builds to fail if there are type errors
    ignoreBuildErrors: false,
  },
  
  // Ensure CSS is extracted with consistent naming
  webpack: (config, { isServer }) => {
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
