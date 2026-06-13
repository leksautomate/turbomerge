import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["archiver", "pg-boss", "mime-types", "@prisma/adapter-pg"],
};

export default nextConfig;
