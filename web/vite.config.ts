import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';

export default defineConfig({
  base: './',
  test: {include: ['src/**/*.test.ts', '../brain/tests/**/*.test.ts'], environment: 'node'},
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        cinematic: resolve(__dirname, 'cinematic/index.html'),
        capture: resolve(__dirname, 'capture/index.html'),
      },
    },
  },
  server: {
    open: false,
  },
});
