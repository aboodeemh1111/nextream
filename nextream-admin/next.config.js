/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    // Admin previews legacy Firebase + MinIO URLs; the optimizer returns 402
    // when Firebase billing is disabled, so serve them unoptimized.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
      },
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "nextream.onrender.com",
      },
      // Keep until the Firebase backfill is done, then drop.
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "storage.nextream.app",
      },
    ],
  },
  async rewrites() {
    return process.env.NODE_ENV === "development"
      ? [
          {
            source: "/api/:path*",
            // Use 127.0.0.1 — on Windows, localhost can resolve to ::1 and
            // Next's rewrite proxy hangs until the client axios timeout.
            destination: "http://127.0.0.1:8800/api/:path*",
          },
        ]
      : [
          {
            source: "/api/:path*",
            destination: "https://nextream.onrender.com/api/:path*",
          },
        ];
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
  serverExternalPackages: [],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value:
              "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
