import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'mender-compact-apk-cleanup',
        closeBundle() {
          // Исключаем временные медиа-вложения чата (public/assets/aistudio) из итоговой сборки dist/,
          // чтобы сборка и APK-пакет весили ~1.8 МБ (строго меньше 20 МБ).
          const aistudioAssetsDir = path.resolve(__dirname, 'dist/assets/aistudio');
          if (fs.existsSync(aistudioAssetsDir)) {
            fs.rmSync(aistudioAssetsDir, {recursive: true, force: true});
          }
        },
      },
    ],
    build: {
      sourcemap: false,
      minify: 'esbuild',
      cssMinify: true,
      target: 'es2020',
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/lucide-react') || id.includes('node_modules/motion')) {
              return 'vendor-ui';
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

