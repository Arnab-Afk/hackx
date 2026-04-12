import type { NextConfig } from "next";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "https://backendapi.comput3.xyz";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Proxy /api/backend/:path* → backend server
        // Browser only ever talks to the same origin → no CORS
        source: "/api/backend/:path*",
        destination: `${BACKEND}/:path*`,
      },
    ];
  },
};

export default nextConfig;
