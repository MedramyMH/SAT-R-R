import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  plugins: [react(), VitePWA({
    registerType: "autoUpdate",
    includeAssets: ["icons/icon-192.png"],
    manifest: false,
    workbox: { navigateFallback: "/index.html", globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"] }
  })]
});
