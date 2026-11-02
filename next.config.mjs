/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['*.e2b.app', '*.vercel.app', 'localhost', '127.0.0.1'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
