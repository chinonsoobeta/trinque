import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Apple requires this exact path, and app-router segments cannot start with a dot.
      { source: "/.well-known/apple-app-site-association", destination: "/api/apple-app-site-association" },
    ];
  },
};

export default nextConfig;
