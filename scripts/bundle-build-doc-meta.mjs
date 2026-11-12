// Regenerează scripts/build-doc-meta.mjs (un singur fișier, doar built-in Node) din lib/docIndex.ts.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await build({
  entryPoints: [path.join(root, 'scripts/build-doc-meta.entry.ts')],
  outfile: path.join(root, 'scripts/build-doc-meta.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  banner: { js: '// GENERAT cu: node scripts/bundle-build-doc-meta.mjs (nu edita manual)' },
  plugins: [
    {
      // nu include metadatele statice în script
      name: 'empty-static-meta',
      setup(b) {
        b.onResolve({ filter: /doc-meta\.json$/ }, () => ({ path: 'empty', namespace: 'empty-meta' }));
        b.onLoad({ filter: /.*/, namespace: 'empty-meta' }, () => ({ contents: '{}', loader: 'json' }));
      },
    },
  ],
});
console.log('OK');
