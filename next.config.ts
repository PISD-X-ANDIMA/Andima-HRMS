import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Human ships a Node and a browser bundle. The biometric routes run only
    // in the browser, so force Turbopack to select the browser ESM bundle.
    resolveAlias: {
      "@vladmandic/human": "./node_modules/@vladmandic/human/dist/human.esm.js",
    },
  },
};

export default nextConfig;
