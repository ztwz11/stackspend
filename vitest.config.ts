import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./tools/test/server-only-empty.ts", import.meta.url)),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, "dist/**"],
    testTimeout: 30000,
  },
});
