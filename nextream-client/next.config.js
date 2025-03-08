/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'image.tmdb.org', 'images.unsplash.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8800/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig; 