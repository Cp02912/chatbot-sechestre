import { promises as fs } from 'node:fs';
import path from 'node:path';
import { buildAllDocMeta } from '../lib/docIndex';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const state = arg('state');
  const docs = arg('docs');
  const out = arg('out');
  if (!state || !docs || !out) {
    console.error('Utilizare: node build-doc-meta.mjs --state <index-state.json> --docs <folder> --out <fisier.json>');
    process.exit(1);
  }
  process.env.STATE_FILE = path.resolve(state);
  process.env.DOCS_DIR = path.resolve(docs);
  const meta = await buildAllDocMeta();
  const n = Object.keys(meta).length;
  await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
  await fs.writeFile(path.resolve(out), JSON.stringify(meta));
  console.log(`Scrise ${n} intrari in ${out}`);
  if (n === 0) console.warn('Atentie: nicio intrare (verifica --state).');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
