import { defineConfig, mergeConfig, type UserConfigFnObject } from 'vite';
import base from '../vite.config';

// The trailer's dev server: no hot reload and no file watching, so editing the project while
// a render runs can't reload the page halfway through.
export default defineConfig((env) =>
  mergeConfig((base as UserConfigFnObject)(env), { root: '.', server: { port: 5174, strictPort: true, hmr: false, watch: null } }),
);
