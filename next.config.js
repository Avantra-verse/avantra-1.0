/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/',
          destination: '/multiverse/index.html',
        },
      ],
    };
  },
};

module.exports = nextConfig;
