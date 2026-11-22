import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import pkg from './package.json';

const version = pkg.version;

// `npm run build` makes the deployable site in dist/.
// `npm run build:preview` inlines everything into one HTML file (dist-preview/index.html),
// which is what gets published as the Claude artifact for playtesting.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'preview' ? [viteSingleFile()] : [],
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { outDir: mode === 'preview' ? 'dist-preview' : 'dist' },
  test: { globals: true, environment: 'node', include: ['tests/*.test.ts', 'worker/**/*.test.ts'] },
}));
