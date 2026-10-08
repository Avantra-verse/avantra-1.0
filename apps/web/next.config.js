/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  // Events stays hidden until it goes public; delete this and restore the dashboard "Events & teams" link (git history).
  redirects: () => [{ source: "/events", destination: "/dashboard", permanent: false }],
};

module.exports = nextConfig;
