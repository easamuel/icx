/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@icx/shared-types', '@icx/ui-core'],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://127.0.0.1:4000/api/v1/:path*',
      },
    ];
  },
};

export default nextConfig;

