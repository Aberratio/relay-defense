/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths: the build is served from /tools/relay-defense/ on kokot.it.
  base: './',
  server: { host: 'localhost' },
  preview: { host: 'localhost' },
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] },
});
