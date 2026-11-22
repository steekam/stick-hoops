// Turn the single-file preview build into the shape the Claude artifact viewer expects:
// page content only (title, styles, scripts, body markup), no <html>/<head>/<body> wrappers,
// because the viewer wraps the file in its own skeleton.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('dist-preview/index.html', 'utf8');
const head = src.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? '';
const body = src.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? '';
const keep = head
  .split(/\n(?=\s*<)/)
  .filter((l) => !/<meta charset|<meta name="viewport"/i.test(l))
  .join('\n');
writeFileSync('dist-preview/artifact.html', `${keep.trim()}\n${body.trim()}\n`);
console.log('wrote dist-preview/artifact.html');
