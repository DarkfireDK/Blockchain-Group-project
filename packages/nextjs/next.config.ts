import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.LAUNCHER_SMOKE_TEST === "1" ? ".next-launcher-test" : ".next",
  reactStrictMode: true,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: false,
  },
};

const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = {
    unoptimized: true,
  };
}

export default nextConfig;
