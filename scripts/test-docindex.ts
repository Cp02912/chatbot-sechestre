import path from 'node:path';
const root = path.resolve(__dirname, '..', 'samples');
process.env.STATE_FILE = path.join(root, 'index-state.sample.json');
process.env.DOCS_DIR = root;
async function main() {
  const { getDocMeta } = await import('../lib/docIndex');
  for (let i = 1; i <= 20; i++) {
    const m = await getDocMeta(`file-${i}`);
    console.log(m ? `${m.title} | ${m.subtitle}` : `file-${i}: null`);
  }
  console.log('unknown:', await getDocMeta('nope'));
  const hint = 'Abramov Serghei Nicolae - Articolul 186. Furtul 2023-12-19.md'.replace(/ă/g, 'a');
  console.log('hint:', (await getDocMeta('nope', hint))?.title);
}
main();
