import type { NextConfig } from "next";
import os from "os";

const isLocalhost = os.hostname() === 'jalfaiatpc';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['blindtest.jl423.xyz'],
  devIndicators: {
    appIsrStatus: isLocalhost,
    buildActivity: isLocalhost,
  } as any,
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
