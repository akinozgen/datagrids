import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: "demo",
  publicDir: false,
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: { port: 5174, strictPort: true },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Datagrids",
      fileName: (format) =>
        format === "es"
          ? "datagrids.js"
          : format === "iife"
            ? "datagrids.global.js"
            : `datagrids.${format}`,
      formats: ["es", "cjs", "iife"],
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) =>
          assetInfo.names?.some((n) => n.endsWith(".css"))
            ? "datagrids.css"
            : "[name][extname]",
      },
    },
  },
});
