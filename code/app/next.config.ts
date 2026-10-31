import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const dir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // campus-map ships TS source for the consumer to transpile
  transpilePackages: ["@slotinvaders/campus-map"],
  turbopack: {
    // widen the root so Turbopack can read the sibling package at ../common/
    root: path.resolve(dir, ".."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
