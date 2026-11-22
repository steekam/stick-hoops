import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` makes the deployable site in dist/.
// `npm run build:preview` inlines everything into one HTML file (dist-preview/index.html),
// which is what gets published as the Claude artifact for playtesting.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'preview' ? [viteSingleFile()] : [],
  build: { outDir: mode === 'preview' ? 'dist-preview' : 'dist' },
  test: { globals: true, environment: 'node' },
}));
