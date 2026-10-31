import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // the campus-map package ships TS source for the consumer to transpile
  transpilePackages: ["@slotinvaders/campus-map"],
  // widen Turbopack's root so it can read the sibling package at ../common/
  turbopack: {
    root: path.resolve(dir, ".."),
    resolveAlias: {
      "@slotinvaders/campus-map": path.resolve(dir, "../common/campus-map/src/index.ts"),
    },
  },
};

export default nextConfig;
