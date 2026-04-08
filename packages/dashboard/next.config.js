/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.reservr.eg' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'localhost' },
    ],
  },
  // RTL/Arabic: handled via <html lang="ar" dir="rtl"> in layout.tsx
  // Serwist (PWA): temporarily disabled — @serwist/next@9 webpack plugin
  // crashes Next.js 15.5 compilation on Linux. Re-enable after upgrading
  // to @serwist/next@10 which adds Next.js 15 support.
};

module.exports = nextConfig;
