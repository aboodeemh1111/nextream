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
        hostname: 'image.tmdb.org',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'nextream-api.onrender.com',
      },
      {
        protocol: 'https',
        hostname: 'nextstream.onrender.com',
      },
    ],
    domains: ['localhost', 'nextstream.onrender.com', 'nextream-api.onrender.com'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    unoptimized: process.env.NODE_ENV === 'development',
  },
  async rewrites() {
    return [
      // In development, proxy to local API
      ...(process.env.NODE_ENV === 'development' 
        ? [
            {
              source: '/api/:path*',
              destination: 'http://localhost:8800/api/:path*',
            }
          ] 
        : []),
      // Always include these rewrites for production to handle CORS
      {
        source: '/auth/:path*',
        destination: 'https://nextream-api.onrender.com/auth/:path*',
      },
      {
        source: '/api/auth/:path*',
        destination: 'https://nextream-api.onrender.com/api/auth/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'https://nextream-api.onrender.com/api/:path*',
      }
    ];
  },
  // Add headers to handle CORS
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, token' },
        ],
      },
    ];
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  experimental: {
    // This is experimental but can be helpful for debugging
    // or working around specific issues with the build.
    serverActions: {
      bodySizeLimit: '2mb',
    },
    serverComponentsExternalPackages: [],
  },
};

module.exports = nextConfig; 