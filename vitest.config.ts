import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Several test files run integration-style assertions against the same
    // live Postgres DB (see tests/services/**) and tag their fixtures with a
    // shared "_TEST" naming convention for cleanup — running files in
    // parallel lets one file's cleanup delete another's in-flight fixture.
    // Serializing file execution is the correct fix for shared-live-resource
    // tests, not a workaround.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
