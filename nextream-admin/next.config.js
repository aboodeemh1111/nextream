/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      "localhost",
      "image.tmdb.org",
      "images.unsplash.com",
      "nextream-api.onrender.com",
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async rewrites() {
    return process.env.NODE_ENV === "development"
      ? [
          {
            source: "/api/:path*",
            destination: "http://localhost:8800/api/:path*",
          },
        ]
      : [
          {
            source: "/api/:path*",
            destination: "https://nextream-api.onrender.com/api/:path*",
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
      bodySizeLimit: "2mb",
    },
  },
  // Moved out of experimental as per Next.js 15.2.1 requirements
  serverExternalPackages: [],
};

module.exports = nextConfig;
