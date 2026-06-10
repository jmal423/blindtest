import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['blindtest.jl423.xyz'],
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
        pathname: "**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
