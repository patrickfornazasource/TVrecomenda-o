/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

// base relativa: o mesmo build roda no navegador e dentro do APK
export default defineConfig({
  base: './',
  // legacy: TV Boxes antigas trazem WebViews velhos, sem suporte a módulos ES
  plugins: [react(), legacy({ targets: ['chrome >= 49', 'android >= 5'] })],
  build: { chunkSizeWarningLimit: 2000 },
  json: { stringify: true },
  test: { globals: true },
});
