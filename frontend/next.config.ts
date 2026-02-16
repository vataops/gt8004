import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude lucid-evolution and related WASM packages from server-side bundling
  serverExternalPackages: [
    '@lucid-evolution/lucid',
    '@anastasia-labs/cardano-multiplatform-lib-nodejs',
    '@anastasia-labs/cardano-multiplatform-lib-browser',
  ],
  // Empty turbopack config to acknowledge we're using Turbopack
  turbopack: {},
  // Allow unsafe-eval for WASM/Lucid libraries that require it
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "script-src 'self' 'unsafe-eval' 'unsafe-inline'; object-src 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
