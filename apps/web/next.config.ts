import type { NextConfig } from 'next';
const config: NextConfig = { transpilePackages: ['@science/core'], experimental:{serverActions:{bodySizeLimit:'5mb'}} };
export default config;
