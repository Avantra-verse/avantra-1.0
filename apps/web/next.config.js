/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  // The chits PDF reads its fonts from disk (lib/server/chits.ts).
  outputFileTracingIncludes: { "/admin/wall/chits.pdf": ["./assets/fonts/*.ttf"] },
  // Events stays hidden until it goes public; delete this and restore the dashboard "Events & teams" link (git history).
  redirects: () => [{ source: "/events", destination: "/dashboard", permanent: false }],
  // No other site may show our pages in a frame (clickjacking on /admin). We embed Google's form, not the reverse.
  headers: () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      ],
    },
  ],
};

module.exports = nextConfig;
