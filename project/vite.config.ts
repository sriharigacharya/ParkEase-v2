import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'], // Your existing optimizeDeps setting
  },
  // Add the 'server' configuration block here
  server: {
    port: 5173, // This is likely your current frontend port, ensure it matches.
                // If you omit this, Vite will use its default (often 5173).
    proxy: {
      // When your frontend calls any path starting with '/api'
      // (e.g., '/api/auth/login', '/api/locations')
      // Vite will forward that request to your backend server.
      '/api': {
        target: 'http://localhost:5000', // The address of your backend Express server
        changeOrigin: true, // Recommended for proper proxying of origin header
        // secure: false, // Uncomment if your backend server is HTTP and not HTTPS.
                         // For localhost development, this is usually not an issue.

        // Optional: If your backend API routes do NOT start with /api
        // (e.g., your backend login route is just /auth/login instead of /api/auth/login),
        // you might need to rewrite the path:
        // rewrite: (path) => path.replace(/^\/api/, '')
        // Based on your setup so far, your backend routes *do* start with /api,
        // so you probably don't need the rewrite rule.
      },
      '/uploads': {
        target: 'http://localhost:5000', // Your backend server address
        changeOrigin: true,
        // secure: false, // Optional
      }
    },
  },
});