import { resolve } from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@sim-dashboard/shared'],
  turbopack: { root: resolve(__dirname, '../..') },
  async headers() {
    return [{ source: '/admin/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }] }];
  },
};

export default config;
