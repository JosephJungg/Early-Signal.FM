import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api calls go through Vite to the Spring Boot backend, so no CORS setup is needed.
// Point at another backend with VITE_API_PROXY=https://... npm run dev
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY ?? 'http://localhost:8080', changeOrigin: true },
    },
  },
});
