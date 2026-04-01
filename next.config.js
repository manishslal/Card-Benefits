/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Set to false if you want production builds to fail if there are type errors
    ignoreBuildErrors: false,
  },
  // Database connection pooling for Prisma
  experimental: {
    // Enable other experimental features as needed
  },
};

module.exports = nextConfig;
