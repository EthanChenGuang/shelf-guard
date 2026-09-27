import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync } from 'node:fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const OPENCV_SRC = path.resolve(
  __dirname,
  'node_modules/@techstark/opencv-js/dist/opencv.js',
);
const OPENCV_DEST_DIR = path.resolve(__dirname, 'public/opencv');
const OPENCV_DEST = path.resolve(OPENCV_DEST_DIR, 'opencv.js');

function copyOpenCvRuntime() {
  mkdirSync(OPENCV_DEST_DIR, { recursive: true });
  cpSync(OPENCV_SRC, OPENCV_DEST);
}

export default defineConfig(() => {
  return {
    plugins: [
      {
        name: 'copy-opencv-runtime',
        configureServer() {
          copyOpenCvRuntime();
        },
        buildStart() {
          copyOpenCvRuntime();
        },
      },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: false,
        workbox: {
          // OpenCV worker chunk (~16 MB) loads on demand — exclude from precache (Pitfall 1)
          globIgnores: ['**/visionWorker*.js', '**/opencv/**'],
          maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
