import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Library dipisah dari kode aplikasi. Library jarang berubah, jadi setelah deploy ulang
        // browser cukup download ulang chunk aplikasi yang kecil, three.js dan GSAP tetap dari cache
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules/gsap/')) return 'gsap';
        }
      }
    },
    // Three.js sendiri sekitar 525 KB setelah minify (132 KB gzip), dan gak bisa dipecah lagi
    // karena hampir semua modul scene butuh namespace THREE. Batasnya dinaikkan sedikit di atas itu,
    // jadi peringatan tetap muncul kalau chunk lain ikut membengkak
    chunkSizeWarningLimit: 600
  }
});
