/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'image.tmdb.org', 'images.unsplash.com', 'nextream-api.onrender.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return process.env.NODE_ENV === 'development'
      ? [
          {
            source: '/api/:path*',
            destination: 'http://localhost:8800/api/:path*',
          },
        ]
      : [
          {
            source: '/api/:path*',
            destination: 'https://nextream-api.onrender.com/api/:path*',
          },
        ];
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig; 