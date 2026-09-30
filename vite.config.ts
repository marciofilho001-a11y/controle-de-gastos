import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // duas páginas: o app e a do ícone "Lançar" (manifesto próprio pro iPhone)
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        lancar: path.resolve(__dirname, "lancar/index.html"),
      },
    },
  },
})
