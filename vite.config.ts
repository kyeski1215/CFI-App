import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// BASE lets the same build run at a domain root or under /cfi-app/ on GitHub Pages.
export default defineConfig({
  base: process.env.BASE ?? "./",
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC") },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Dual Given",
        short_name: "Dual Given",
        description: "Training for flight instructors and their students: roster, syllabus, debriefs, mock checkrides and study.",
        theme_color: "#f7f5f2",
        background_color: "#f7f5f2",
        display: "standalone",
        start_url: ".",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,svg,png,woff2}"], maximumFileSizeToCacheInBytes: 4_000_000 },
    }),
  ],
});
