import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./client/src/test/setup.ts"],
    include: ["client/src/test/**/*.test.{ts,tsx}"],
    globals: true,
    css: true,
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
