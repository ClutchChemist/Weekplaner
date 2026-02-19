import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES ? "/Weekplaner/" : "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "vendor-react";
          }

          if (id.includes("node_modules/@dnd-kit")) {
            return "vendor-dnd";
          }

          if (id.includes("node_modules/@supabase")) {
            return "vendor-supabase";
          }

          if (id.includes("node_modules/html-to-image")) {
            return "vendor-image";
          }

          return "vendor-misc";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5055",
        changeOrigin: true,
      },
    },
  },
});
