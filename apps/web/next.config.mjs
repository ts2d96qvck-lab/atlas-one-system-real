/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:4000 http://localhost:4000 https: wss:; frame-ancestors 'none'"
  }
];

const nextConfig = {
  reactStrictMode: true,
  ...(process.env.DOCKER_BUILD === "true" ? { output: "standalone" } : {}),
  transpilePackages: ["@atlas-one/ui", "@atlas-one/lib"],
  experimental: {
    typedRoutes: true
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders
      }
    ];
  },
  async rewrites() {
    const apiBase = process.env.ATLAS_API_PROXY ?? "http://127.0.0.1:4000";
    return [
      { source: "/media/:path*", destination: `${apiBase}/media/:path*` },
      { source: "/api/:path*", destination: `${apiBase}/api/:path*` },
      { source: "/inbox/:path*", destination: `${apiBase}/inbox/:path*` },
      { source: "/auth/:path*", destination: `${apiBase}/auth/:path*` },
      { source: "/admin/:path*", destination: `${apiBase}/admin/:path*` },
      { source: "/whatsapp/:path*", destination: `${apiBase}/whatsapp/:path*` },
      { source: "/crm/:path*", destination: `${apiBase}/crm/:path*` },
      { source: "/dashboard/:path*", destination: `${apiBase}/dashboard/:path*` },
      { source: "/campaigns/:path*", destination: `${apiBase}/campaigns/:path*` },
      { source: "/automations/:path*", destination: `${apiBase}/automations/:path*` },
      { source: "/ops/:path*", destination: `${apiBase}/ops/:path*` },
      { source: "/health", destination: `${apiBase}/health` },
      { source: "/ready", destination: `${apiBase}/ready` }
    ];
  }
};

export default nextConfig;
