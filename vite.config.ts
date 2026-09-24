import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
// base "./" e arquivo único: funciona no GitHub Pages (qualquer subpasta) e abrindo o index.html direto.
export default defineConfig({ base: "./", plugins: [react(), viteSingleFile()] });
