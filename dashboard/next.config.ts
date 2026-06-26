import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 uses Turbopack by default.
  // Setting root explicitly silences the "multiple lockfiles" warning.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
