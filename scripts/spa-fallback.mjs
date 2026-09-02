/**
 * GitHub Pages has no rewrite rules: a direct hit on /library would 404.
 * Serving a copy of index.html as 404.html hands those URLs back to the SPA,
 * which then routes on `location.pathname` as usual.
 *
 * `.nojekyll` stops Pages from stripping files and folders starting with "_".
 */
import { copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const index = `${dist}index.html`;

if (!existsSync(index)) {
  console.error('[spa-fallback] dist/index.html introuvable — lance vite build d’abord.');
  process.exit(1);
}

copyFileSync(index, `${dist}404.html`);
writeFileSync(`${dist}.nojekyll`, '');
console.log('[spa-fallback] 404.html et .nojekyll écrits');
