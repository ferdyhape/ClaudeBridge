import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    // Built assets land where the Express server already serves static
    // files from (see PUBLIC_DIR in src/config/claude.js) — `npm run
    // build` here is all that's needed, no wiring on the server side.
    outDir: "../public",
    emptyOutDir: true,
  },
  server: {
    // Lets `npm run dev` (hot reload) talk to the real API server on
    // :4577 instead of needing a production build for every change.
    proxy: {
      "/auth": "http://localhost:4577",
      "/whoami": "http://localhost:4577",
      "/ask": "http://localhost:4577",
      "/health": "http://localhost:4577",
    },
  },
});
