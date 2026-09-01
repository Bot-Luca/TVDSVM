import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // "./" (caminho relativo) em vez de "/" — assim o site funciona tanto na
  // raiz de um domínio quanto num subcaminho, como usuario.github.io/repo/
  // (padrão do GitHub Pages para "project sites"). Não precisa mudar nada
  // aqui ao trocar de nome de repositório.
  base: "./",
});
