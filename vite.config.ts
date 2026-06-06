import { cloudflare } from "@cloudflare/vite-plugin";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [preact(), ...(mode === "test" ? [] : [cloudflare()])],
  server: {
    port: 5173,
  },
}));
