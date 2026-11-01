import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Images are resized by Lintel (see lib/images.ts), so Next.js doesn't need to.
  images: { unoptimized: true },
};

export default nextConfig;
