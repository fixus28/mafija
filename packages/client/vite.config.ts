import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // dostupno i drugima na lokalnoj mrezi (testiranje sa vise uredjaja)
    port: 5173,
  },
});
