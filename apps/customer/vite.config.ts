import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootNodeModules = path.resolve(__dirname, "../../node_modules");

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: path.resolve(rootNodeModules, "react"),
      "react-dom": path.resolve(rootNodeModules, "react-dom"),
      "@tanstack/react-query": path.resolve(rootNodeModules, "@tanstack/react-query"),
    },
    dedupe: ["react", "react-dom", "react-router", "react-router-dom", "@tanstack/react-query"],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react-router",
      "react-router-dom",
      "@tanstack/react-query",
      "lucide-react",
      "socket.io-client",
    ],
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      "/auth": {
        target: "http://localhost:4000",
        changeOrigin: true,
        bypass: (req) => {
          if (req.headers.accept?.includes("text/html")) {
            return "/index.html";
          }
        },
      },
      "/waste-types": {
        target: "http://localhost:4000",
        changeOrigin: true,
        bypass: (req) => {
          if (req.headers.accept?.includes("text/html")) {
            return "/index.html";
          }
        },
      },
      "/addresses": {
        target: "http://localhost:4000",
        changeOrigin: true,
        bypass: (req) => {
          if (req.headers.accept?.includes("text/html")) {
            return "/index.html";
          }
        },
      },
      "/geo": {
        target: "http://localhost:4000",
        changeOrigin: true,
        bypass: (req) => {
          if (req.headers.accept?.includes("text/html")) {
            return "/index.html";
          }
        },
      },
      "/bookings": {
        target: "http://localhost:4000",
        changeOrigin: true,
        bypass: (req) => {
          if (req.headers.accept?.includes("text/html")) {
            return "/index.html";
          }
        },
      },
      "/payments": {
        target: "http://localhost:4000",
        changeOrigin: true,
        bypass: (req) => {
          if (req.headers.accept?.includes("text/html")) {
            return "/index.html";
          }
        },
      },
      "/ai": {
        target: "http://localhost:4000",
        changeOrigin: true,
        bypass: (req) => {
          if (req.headers.accept?.includes("text/html")) {
            return "/index.html";
          }
        },
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:4000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "es2022",
    minify: "esbuild",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-icons": ["lucide-react"],
          "vendor-socket": ["socket.io-client"],
        },
      },
    },
  },
});
