import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy API requests to the backend during development
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      // Proxy WebSocket connections
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
      },
    },
  },
  optimizeDeps: {
    include: ["@google/genai"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  resolve: {
    conditions: ["browser", "module", "import"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./setupTests.ts",
  },
});
