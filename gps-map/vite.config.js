import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",   // default, but explicit
    emptyOutDir: true
  }
});
