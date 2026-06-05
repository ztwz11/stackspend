import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import("next").NextConfig} */
const nextConfig = {
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
