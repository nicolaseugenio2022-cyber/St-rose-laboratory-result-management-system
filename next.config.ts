import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // React Compiler. Next.js 15.5 accepts the flag under `experimental`; the top-level
    // `reactCompiler` key only exists from Next.js 16. Runs babel-plugin-react-compiler on
    // client components with JSX or hooks; no Babel config file is involved.
    reactCompiler: true,
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
