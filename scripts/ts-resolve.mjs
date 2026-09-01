/**
 * Lets plain `node` run the app's TypeScript sources directly.
 *
 * Node already strips the types; what it does not do is resolve Vite-style
 * specifiers — extensionless relative imports and the `@/` alias. This hook
 * fills exactly that gap, so the smoke scripts test the real source files
 * rather than a copy.
 *
 * Usage: node --import ./scripts/ts-resolve.mjs scripts/<script>.mjs
 */
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = new URL('../src/', import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const spec = specifier.startsWith('@/')
      ? new URL(specifier.slice(2), SRC).href
      : specifier;

    if (spec.startsWith('.') || spec.startsWith('file:')) {
      const base = new URL(spec, context.parentURL ?? import.meta.url);
      const candidates = [base.href, `${base.href}.ts`, `${base.href}.tsx`, `${base.href}/index.ts`];
      for (const candidate of candidates) {
        if (existsSync(fileURLToPath(candidate))) return { url: candidate, shortCircuit: true };
      }
    }

    return nextResolve(specifier, context);
  },
});
