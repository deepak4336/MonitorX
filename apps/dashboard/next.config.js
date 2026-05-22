/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@monitorx/browser', '@monitorx/sdk-core', '@monitorx/shared-types'],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
};

module.exports = nextConfig;
