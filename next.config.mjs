/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/webp'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['zod', 'react-hook-form'],
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
  },
};

export default nextConfig;
