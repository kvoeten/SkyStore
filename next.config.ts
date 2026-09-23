import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  typedRoutes: true,
  // The local Docker development server is reached from the Windows host.
  // Explicitly permit that origin so Next can serve its client assets rather
  // than leaving browser routes stuck on their loading state.
  allowedDevOrigins: ["127.0.0.1", "localhost"]
};

export default nextConfig;
