import { fileURLToPath, URL } from "node:url";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function resolveGitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "nogit";
  }
}

const packageJsonPath = fileURLToPath(new URL("./package.json", import.meta.url));
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { version?: string };
const appVersion = String(packageJson.version ?? "0.0.0");
const gitSha = resolveGitSha();
const buildVersion = `v${appVersion}+${gitSha}`;

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES ? "/Weekplaner/" : "/",
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __GIT_COMMIT__: JSON.stringify(gitSha),
    __BUILD_VERSION__: JSON.stringify(buildVersion),
  },
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

          if (id.includes("node_modules/pdfjs-dist")) {
            return "vendor-pdf";
          }

          if (id.includes("node_modules/exceljs")) {
            return "vendor-excel";
          }

          return undefined;
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
