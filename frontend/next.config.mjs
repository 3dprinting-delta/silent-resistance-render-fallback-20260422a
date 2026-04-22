/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  generateBuildId: async () => {
    return process.env.NEXT_BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "workspace-build";
  },
};

export default nextConfig;
