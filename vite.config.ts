import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/social-impact/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",

      manifest: {
        name: "Social Impact",
        short_name: "Social Impact",
        description: "Together We Make A Difference",
        theme_color: "#177865",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: ".",

        icons: [
          {
            src: "favicon.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "favicon1.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});
