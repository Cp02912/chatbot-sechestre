import { promises as fs } from 'node:fs';
import path from 'node:path';
import staticMeta from '../data/doc-meta.json';

export type DocMeta = {
  fileId: string;
  fileName: string;
  title: string;
  subtitle: string;
  tipAct?: string;
  instanta?: string;
  dosar?: string;
  data?: string;
  materie?: string;
  articol?: string;
  parti?: string;
};

type Attrs = {
  fisier?: string; data?: string; an?: string | number; titlu?: string; articol?: string;
  tip_act?: string; materie?: string; nivel?: string; instanta?: string;
  instanta_fond?: string; dosar?: string;
};
type StateEntry = { fileId?: string; attached?: boolean; attributes?: Attrs };

const STATE_FILE = () => process.env.STATE_FILE || path.resolve(/*turbopackIgnore: true*/ process.cwd(), '..', 'index-state.json');
const DOCS_DIR = () => process.env.DOCS_DIR || path.resolve(/*turbopackIgnore: true*/ process.cwd(), '..', 'documente_cn4000-main');
const READ_BYTES = 8192;

// ---------------------------------------------------------------- state cache
type StateCache = {
  mtimeMs: number;
  byId: Map<string, { fileName: string; entry: StateEntry }>;
  byAscii: Map<string, { fileName: string; entry: StateEntry }>;
};
let stateCache: StateCache | null = null;
let statePromise: Promise<StateCache> | null = null;
const metaCache = new Map<string, DocMeta>(); // key: fileId + '\0' + fileName

export function asciiUploadName(name: string): string {
  let s = name.normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/[^A-Za-z0-9 ._()\[\],-]/g, '_');
  return s.slice(0, 180).toLowerCase();
}

async function loadState(): Promise<StateCache> {
  const file = STATE_FILE();
  let mtimeMs = -1;
  try { mtimeMs = (await fs.stat(file)).mtimeMs; } catch { /* missing */ }
  if (stateCache && stateCache.mtimeMs === mtimeMs) return stateCache;
  if (statePromise) {
    const p = statePromise;
    const c = await p;
    if (c.mtimeMs === mtimeMs) return c;
  }
  statePromise = (async () => {
    const byId = new Map<string, { fileName: string; entry: StateEntry }>();
    const byAscii = new Map<string, { fileName: string; entry: StateEntry }>();
    try {
      const raw = JSON.parse(await fs.readFile(file, 'utf8'));
      const files: Record<string, StateEntry> = raw?.files ?? {};
      for (const [fileName, entry] of Object.entries(files)) {
        const e = entry || {};
        if (e.fileId) byId.set(e.fileId, { fileName, entry: e });
        byAscii.set(asciiUploadName(fileName), { fileName, entry: e });
      }
    } catch { /* unreadable -> empty */ }
    const c: StateCache = { mtimeMs, byId, byAscii };
    stateCache = c;
    return c;
  })();
  try { return await statePromise; } finally { statePromise = null; }
}

// ---------------------------------------------------------------- text helpers
const UP = 'A-ZĂÎÂȘȚ';
const LO = 'a-zăîâșț';
const WORD = `[${UP}][${LO}${UP}\\-]+`;

function normDia(s: string): string {
  return s.replace(/ş/g, 'ș').replace(/Ş/g, 'Ș').replace(/ţ/g, 'ț').replace(/Ţ/g, 'Ț');
}

/** Remove markdown, turn anonymization (\*\*\*\*\*) into the placeholder ¤. */
function cleanText(s: string): string {
  s = normDia(s);
  s = s.replace(/\\\*+/g, '¤');
  s = s.replace(/[*#]+/g, ' ');
  s = s.replace(/\\(.)/g, '$1');
  s = s.replace(/¤(?:\s*¤)+/g, '¤');
  s = s.replace(/\s+/g, ' ');
  return s.trim();
}

function titleCaseIfUpper(s: string): string {
  const letters = s.replace(/[^A-Za-zĂÎÂȘȚăîâșț]/g, '');
  if (!letters || letters !== letters.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s\-])([a-zăîâșț])/g, (_, a, b) => a + b.toUpperCase());
}

const SUP: Record<string, string> = { '1': '¹', '2': '²', '3': '³' };
const SUP_ARTS = new Set(['264', '364', '217']);

function fmtArticle(num: string, sub?: string): string {
  if (!sub && num.length === 4 && SUP_ARTS.has(num.slice(0, 3))) { sub = num.slice(3); num = num.slice(0, 3); }
  return sub ? num + (SUP[sub] ?? `/${sub}`) : num;
}

function articleFromName(s: string): string | undefined {
  const m = /Art(?:icol\w*)?\.?\s*(\d{2,4})(?:\s*[\[\/]\s*(\d)\s*\]?|\s+(\d)(?=\s+(?:alin|al\b|CP|Cod)))?/i.exec(s);
  return m ? fmtArticle(m[1], m[2] || m[3]) : undefined;
}

function articleFromText(t: string): string | undefined {
  const head = t.slice(0, 6000);
  const m = /prevăzut\w*\s+(?:de|la|în)\s+(.{0,260})/i.exec(head);
  if (!m) return undefined;
  let seg = m[1];
  const cut = seg.search(/\b(?:Cod\w*|CP)\b/);
  if (cut > 0) seg = seg.slice(0, cut);
  const nums: string[] = [];
  const re = /(?<![\d\w])(\d{2,4})(?:\s*[\[\/]\s*(\d)\s*\]?|\s+(\d)(?=\s+(?:alin|al\b)))?(?=[\s,.)\[]|$)/g;
  let x: RegExpExecArray | null;
  while ((x = re.exec(seg))) {
    // skip "alin. (2)" style single digits handled by \d{2,}; skip years/dates
    if (/^\s*(?:ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)/i.test(seg.slice(x.index + x[0].length))) continue;
    nums.push(fmtArticle(x[1], x[2] || x[3]));
  }
  if (!nums.length) return undefined;
  const main = nums.find((n) => parseInt(n, 10) > 50);
  return main ?? nums[0];
}

function ddmmyyyy(iso?: string): string | undefined {
  if (!iso) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function splitName(fileName: string): { base: string; date?: string } {
  let n = normDia(fileName).replace(/\.md$/i, '');
  const m = /\s+(\d{4}-\d{2}-\d{2})\s*$/.exec(n);
  let date: string | undefined;
  if (m) { date = m[1]; n = n.slice(0, m.index); }
  return { base: n.trim(), date };
}

function shorten(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:-]+$/, '') + '…';
}

// ---------------------------------------------------------------- field detection
function detectTipAct(t: string): string | undefined {
  const re = /(S\s?E\s?N\s?T\s?I\s?N\s?[ȚT]\s?[ĂA])|(D\s?E\s?C\s?I\s?Z\s?I\s?E(?![A-Z]))|(Î\s?N\s?C\s?H\s?E\s?I\s?E\s?R\s?E)|(H\s?O\s?T\s?[ĂA]\s?R\s?[ÎÂI]\s?R\s?E)/;
  const m = re.exec(t.slice(0, 3000));
  if (!m) return undefined;
  if (m[1]) return 'Sentință';
  if (m[2]) return 'Decizie';
  if (m[3]) return 'Încheiere';
  return 'Hotărîre';
}

function normTip(s?: string): string | undefined {
  if (!s) return undefined;
  const l = normDia(s).toLowerCase();
  if (l.startsWith('sentin')) return 'Sentință';
  if (l.startsWith('deciz')) return 'Decizie';
  if (l.startsWith('înch') || l.startsWith('inch')) return 'Încheiere';
  if (l.startsWith('hot')) return 'Hotărîre';
  return s;
}

function detectDosar(t: string): string | undefined {
  const head = t.slice(0, 900);
  const m = /\b(\d{1,2}[a-zA-Z]{0,2})\s*[-–]\s*(\d{1,5})\s*\/\s*(\d{2,4})\b/.exec(head);
  if (m) return `${m[1]}-${m[2]}/${m[3]}`;
  const d = /Dosarul?\s+nr\.?\s*([^\s¤][^\s]*)/i.exec(head);
  if (d && !d[1].includes('¤') && /\d/.test(d[1])) return d[1].replace(/[;,.]$/, '');
  return undefined;
}

const CITY = `(?:¤|${WORD})`;
const SEDIU = `(?:\\s*[,(]?\\s*[Ss]edi(?:ul|u)\\s+(${WORD}(?:\\s*\\([^)]{1,30}\\))?))?`;

function fmtCourt(city: string, sediu?: string): string {
  let s = `Judecătoria ${city}`;
  if (sediu) s += ` (sediul ${sediu.replace(/\s*\(([^)]*)\)/, ', $1')})`;
  return s;
}

const CHISINAU_SEDII = new Set(['Buiucani', 'Rîșcani', 'Botanica', 'Ciocana']);

function detectFirstInstance(t: string, nominativeOnly: boolean): { city?: string; sediu?: string; text?: string } {
  const re = new RegExp(`Judecători${nominativeOnly ? 'a' : '(?:a|ei)'}\\s+(${CITY})${SEDIU}`, 'g');
  let m: RegExpExecArray | null;
  const head = t.slice(0, 3500);
  while ((m = re.exec(head))) {
    let city: string | undefined = m[1] === '¤' ? undefined : m[1];
    let sediu: string | undefined = m[2];
    if (sediu && /^¤/.test(sediu)) sediu = undefined;
    if (!city && sediu && CHISINAU_SEDII.has(sediu)) city = 'Chișinău';
    if (city) return { city, sediu, text: fmtCourt(city, sediu) };
  }
  return {};
}

const CA_BY_FIRST: Record<string, string> = {
  'Chișinău': 'Chișinău', Ungheni: 'Chișinău', Strășeni: 'Chișinău', Ialoveni: 'Chișinău',
  'Bălți': 'Bălți', Soroca: 'Bălți', 'Edineț': 'Bălți', Briceni: 'Bălți', Drochia: 'Bălți',
  Cahul: 'Cahul', Cantemir: 'Cahul', Taraclia: 'Cahul', Comrat: 'Comrat',
};

function detectAppeal(t: string): string | undefined {
  const head = t.slice(0, 3500);
  if (/Curtea Supremă de Justiție|Colegiul[^.]{0,40}lărgit/i.test(head.slice(0, 1500))) return 'Curtea Supremă de Justiție';
  let m = new RegExp(`Cur(?:țile|tea|ții)\\s+de\\s+Apel\\s+(${WORD}(?:\\s+(?:${WORD}))?)`).exec(head);
  if (m) {
    // second word only if it is not a trailing capitalised noun (e.g. "Chișinău Colegiul")
    let city = m[1].split(/\s+/)[0];
    return `Curtea de Apel ${titleCaseIfUpper(city)}`;
  }
  m = new RegExp(`CURTEA\\s+DE\\s+APEL\\s+([${UP}]+)`).exec(head);
  if (m) return `Curtea de Apel ${titleCaseIfUpper(m[1])}`;
  return undefined;
}

function detectInstanta(t: string, tip?: string): string | undefined {
  const appeal = detectAppeal(t);
  if (tip === 'Decizie' || (tip && tip !== 'Sentință' && appeal)) {
    if (appeal) return appeal;
    if (tip === 'Decizie') {
      const fi = detectFirstInstance(t, false);
      const ca = fi.city ? CA_BY_FIRST[fi.city] : undefined;
      return ca ? `Curtea de Apel ${ca}` : 'Curtea de Apel';
    }
  }
  const fi = detectFirstInstance(t, true);
  if (fi.text) return fi.text;
  return appeal;
}

// ---------------------------------------------------------------- party extraction
const GEN_FIX: Array<[RegExp, string]> = [
  [/^Procuraturii\b/, 'Procuratura'], [/^Agenției\b/, 'Agenția'], [/^Primăriei\b/, 'Primăria'],
  [/^Direcției\b/, 'Direcția'], [/^Inspecției\b/, 'Inspecția'], [/^Întreprinderii\b/, 'Întreprinderea'],
  [/^Companiei\b/, 'Compania'], [/^Societății\b/, 'Societatea'], [/^Băncii\b/, 'Banca'],
  [/^Curții\b/, 'Curtea'], [/^Casei\b/, 'Casa'], [/^Judecătoriei\b/, 'Judecătoria'],
];

function fixGenitive(s: string): string {
  for (const [re, r] of GEN_FIX) if (re.test(s)) return s.replace(re, r);
  return s;
}

function cleanParty(s: string, max = 60): string {
  s = s.replace(/¤/g, '').replace(/\s+/g, ' ').replace(/^[\s,;:.\-–"„”]+|[\s,;:.\-–"„”]+$/g, '');
  return shorten(titleCaseIfUpper(s), max);
}

function extractAccused(t: string): string | undefined {
  const head = t.slice(0, 5000);
  const re = new RegExp(
    `(?:în\\s+privința\\s+(?:lui|inculpatului)|privind\\s+condamnarea\\s+lui|privind\\s+învinuirea\\s+lui|învinuire\\s+a\\s+(?:lui|inculpat\\w*)|învinuirea\\s+(?:lui|inculpat\\w*)|condamnarea\\s+lui|inculpatului|inculpatei|inculpații\\s+|condamnatului|învinuitului)\\s*[:\\-–]?\\s*(${WORD}(?:\\s+${WORD}){0,2})`,
    'g',
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(head))) {
    const words = m[1].split(/\s+/).filter((w) => !/^(?:Procurorul|Avocatul|Apărătorul|Cu|În|La)$/i.test(w));
    if (!words.length) continue;
    // stop at lowercase-introduced junk already handled by WORD; drop words that look like roles
    const name = cleanParty(words.join(' '));
    if (name.length >= 4) return name;
  }
  return undefined;
}

function extractCivil(t: string): { title: string; parti: string } | undefined {
  const head = t.slice(0, 6000);
  const xm = /(?:recurent(?:ul|a)|reclamant(?:ul|a)|apelant(?:ul|a)|contestator(?:ul|a)|petiționar(?:ul|a)|solicitant(?:ul|a)|contestatorul)\s+([^,;]{3,90}?)(?=,|;|\s+reprezentat|\s+împotriva)/i.exec(head);
  if (!xm) return undefined;
  const x = cleanParty(xm[1]);
  if (x.length < 3) return undefined;
  const rest = head.slice(xm.index);
  const re = /împotriva\s+([^,;]{3,120}?)(?=,|;|\s+intervenient|\s+privind|\s+prin\b|\s+cu\s+participarea)/gi;
  let ym: RegExpExecArray | null;
  let y: string | undefined;
  let after = 0;
  while ((ym = re.exec(rest))) {
    if (/^(?:încheier|hotărâ|hotărî|deciz|sentin|actului|ordinului|dispoziți)/i.test(ym[1])) continue;
    y = cleanParty(fixGenitive(ym[1]));
    after = ym.index + ym[0].length;
    break;
  }
  let obj: string | undefined;
  const om = /privind\s+([^,.;]{5,120})/i.exec(rest.slice(after));
  if (om) {
    obj = om[1].split(/\s+(?:aplicat|în cadrul|din\s|de către|\()/)[0].trim();
    obj = shorten(obj, 60).replace(/[\s,;:-]+$/, '');
  }
  const parti = y ? `${x} c. ${y}` : x;
  return { title: obj ? `${parti} — ${obj}` : parti, parti };
}

function isPenal(t: string): boolean {
  return /cauza\s+penal[ăa]|învinuire|inculpat|condamnarea\s+lui/i.test(t.slice(0, 2500));
}

function multipleDefendants(t: string): boolean {
  const head = t.slice(0, 3000);
  const m = /(?:învinuire\s+a|învinuirea)\s+inculpaților|inculpaților\s*:/i.exec(head);
  return !!m;
}

// ---------------------------------------------------------------- meta build
function buildMeta(fileId: string, fileName: string, text: string | null, a: Attrs): DocMeta {
  const { base, date: nameDate } = splitName(fileName);
  const t = text ? cleanText(text) : '';
  const tipAct = normTip(a.tip_act) || (t ? detectTipAct(text ? normDia(text).replace(/\\\*/g, '').replace(/[*#]+/g, ' ') : t) : undefined);
  const instanta = a.instanta ? normDia(a.instanta) : t ? detectInstanta(t, tipAct) : undefined;
  const dosar = a.dosar || (t ? detectDosar(t) : undefined);
  const data = nameDate || (a.data && /^\d{4}-\d{2}-\d{2}/.test(a.data) ? a.data.slice(0, 10) : undefined);
  const isUuid = UUID_RE.test(base);

  // person part of filename
  let person = base;
  const cutRe = /[\s-]+(?:Art(?:icolul)?\.?\s*\d|în\s+comiterea|în\s+săvârșirea|în\s+săvîrșirea)/i;
  const cm = cutRe.exec(base);
  if (cm) person = base.slice(0, cm.index);
  person = person.replace(/[\s,;:\-–]+$/, '').replace(/\s+/g, ' ').trim();

  const articol = a.articol ? String(a.articol) : articleFromName(base) || (t ? articleFromText(t) : undefined);
  const artStr = articol ? `art. ${articol.replace(/^art\.?\s*/i, '')} CP` : undefined;

  let title: string | undefined;
  let parti: string | undefined;

  if (a.titlu && a.titlu.trim()) {
    title = shorten(normDia(a.titlu.trim()), 160);
  } else if (!isUuid && person && !/^\d+$/.test(person)) {
    parti = titleCaseIfUpper(person);
    const saa = t && parti.split(' ').length <= 3 && multipleDefendants(t) ? ' ș.a.' : '';
    // civil-looking names (no art.) keep as is
    title = shorten(parti, 130) + saa + (artStr ? ` — ${artStr}` : '');
  } else if (t) {
    if (isPenal(t)) {
      const acc = extractAccused(t);
      if (acc) {
        parti = acc;
        title = acc + (multipleDefendants(t) ? ' ș.a.' : '') + (artStr ? ` — ${artStr}` : '');
      }
    } else {
      const c = extractCivil(t);
      if (c) { title = c.title; parti = c.parti; }
    }
    if (!title) {
      const c = !isPenal(t) ? undefined : extractCivil(t);
      if (c) { title = c.title; parti = c.parti; }
    }
  }
  if (!title) {
    const bits = [tipAct, instanta].filter(Boolean).join(' ');
    title = bits ? `${bits}${dosar ? `, dosar ${dosar}` : ''}` : base || fileName;
    if (!bits && dosar) title = `${base}, dosar ${dosar}`;
  }
  title = title.replace(/¤/g, '').replace(/\*+/g, '').replace(/\s+/g, ' ').trim() || base || fileName;

  const subtitle = [tipAct, instanta, dosar ? `dosar ${dosar}` : undefined, ddmmyyyy(data)].filter(Boolean).join(' · ');

  const meta: DocMeta = { fileId, fileName, title, subtitle };
  if (tipAct) meta.tipAct = tipAct;
  if (instanta) meta.instanta = instanta;
  if (dosar) meta.dosar = dosar;
  if (data) meta.data = data;
  if (a.materie) meta.materie = a.materie;
  if (articol) meta.articol = articol;
  if (parti) meta.parti = parti;
  return meta;
}

async function readHead(fileName: string): Promise<string | null> {
  try {
    const fh = await fs.open(path.join(/*turbopackIgnore: true*/ DOCS_DIR(), fileName), 'r');
    try {
      const buf = Buffer.alloc(READ_BYTES);
      const { bytesRead } = await fh.read(buf, 0, READ_BYTES, 0);
      return buf.subarray(0, bytesRead).toString('utf8');
    } finally { await fh.close(); }
  } catch { return null; }
}

async function metaFor(fileId: string, fileName: string, entry: StateEntry): Promise<DocMeta> {
  const key = `${fileId}\0${fileName}`;
  const hit = metaCache.get(key);
  if (hit) return hit;
  let meta: DocMeta;
  try {
    const text = await readHead(fileName);
    meta = buildMeta(fileId, fileName, text, entry.attributes ?? {});
  } catch {
    const { base, date } = splitName(fileName);
    meta = { fileId, fileName, title: shorten(base || fileName, 140), subtitle: ddmmyyyy(date) ?? '' };
  }
  metaCache.set(key, meta);
  return meta;
}

// ---------------------------------------------------------------- public API
// Metadate pre-generate (data/doc-meta.json, create cu scripts/build-doc-meta.mjs) — folosite primele.
const STATIC = staticMeta as unknown as Record<string, DocMeta>;

/** Folosit de scripts/build-doc-meta.mjs: metadate pentru toate intrările cu fileId, doar din fișiere locale. */
export async function buildAllDocMeta(): Promise<Record<string, DocMeta>> {
  const st = await loadState();
  const out: Record<string, DocMeta> = {};
  for (const [id, { fileName, entry }] of st.byId) out[id] = await metaFor(id, fileName, entry);
  return out;
}

export async function getDocMeta(fileId: string, filenameHint?: string): Promise<DocMeta | null> {
  const pre = Object.prototype.hasOwnProperty.call(STATIC, fileId) ? STATIC[fileId] : undefined;
  if (pre) return pre;
  try {
    const st = await loadState();
    const hit = st.byId.get(fileId);
    if (hit) return await metaFor(fileId, hit.fileName, hit.entry);
    if (filenameHint) {
      const hint = filenameHint.split(/[\\/]/).pop() || filenameHint;
      const h = st.byAscii.get(asciiUploadName(hint));
      if (h) return await metaFor(fileId, h.fileName, h.entry);
    }
  } catch { /* fall through */ }
  return null;
}

export async function getDocMetaMany(fileIds: string[]): Promise<Record<string, DocMeta>> {
  const out: Record<string, DocMeta> = {};
  const uniq = Array.from(new Set(fileIds));
  await Promise.all(uniq.map(async (id) => {
    const m = await getDocMeta(id);
    if (m) out[id] = m;
  }));
  return out;
}
