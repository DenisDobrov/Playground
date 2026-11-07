import type { NextConfig } from 'next';
const config: NextConfig = { transpilePackages: ['@science/core'], experimental:{serverActions:{bodySizeLimit:'5mb'}},
  async headers(){return [{source:'/:path*',headers:[{key:'Referrer-Policy',value:'strict-origin'}]}];}
};
export default config;
