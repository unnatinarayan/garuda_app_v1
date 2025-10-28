import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),

  ],
  server: {
    // CRITICAL: Configure the proxy here
    proxy: {
      // Proxy all requests starting with /api to the backend Express server
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Optional: Rewrite /api to empty path if your backend didn't use /api
        // but since your backend uses /api, this is usually not needed.
      },
    }
  },
  resolve: {
    alias: {
      // This maps the "@/" alias used in your imports to the absolute path of the 'src' directory.
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});