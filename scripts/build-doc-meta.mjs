// GENERAT cu: node scripts/bundle-build-doc-meta.mjs (nu edita manual)

// scripts/build-doc-meta.entry.ts
import { promises as fs2 } from "node:fs";
import path2 from "node:path";

// lib/docIndex.ts
import { promises as fs } from "node:fs";
import path from "node:path";
var STATE_FILE = () => process.env.STATE_FILE || path.resolve(
  /*turbopackIgnore: true*/
  process.cwd(),
  "..",
  "index-state.json"
);
var DOCS_DIR = () => process.env.DOCS_DIR || path.resolve(
  /*turbopackIgnore: true*/
  process.cwd(),
  "..",
  "documente_cn4000-main"
);
var READ_BYTES = 8192;
var stateCache = null;
var statePromise = null;
var metaCache = /* @__PURE__ */ new Map();
function asciiUploadName(name) {
  let s = name.normalize("NFD").replace(/[̀-ͯ]/g, "");
  s = s.replace(/[^A-Za-z0-9 ._()\[\],-]/g, "_");
  return s.slice(0, 180).toLowerCase();
}
async function loadState() {
  const file = STATE_FILE();
  let mtimeMs = -1;
  try {
    mtimeMs = (await fs.stat(file)).mtimeMs;
  } catch {
  }
  if (stateCache && stateCache.mtimeMs === mtimeMs) return stateCache;
  if (statePromise) {
    const p = statePromise;
    const c = await p;
    if (c.mtimeMs === mtimeMs) return c;
  }
  statePromise = (async () => {
    const byId = /* @__PURE__ */ new Map();
    const byAscii = /* @__PURE__ */ new Map();
    try {
      const raw = JSON.parse(await fs.readFile(file, "utf8"));
      const files = raw?.files ?? {};
      for (const [fileName, entry] of Object.entries(files)) {
        const e = entry || {};
        if (e.fileId) byId.set(e.fileId, { fileName, entry: e });
        byAscii.set(asciiUploadName(fileName), { fileName, entry: e });
      }
    } catch {
    }
    const c = { mtimeMs, byId, byAscii };
    stateCache = c;
    return c;
  })();
  try {
    return await statePromise;
  } finally {
    statePromise = null;
  }
}
var UP = "A-Z\u0102\xCE\xC2\u0218\u021A";
var LO = "a-z\u0103\xEE\xE2\u0219\u021B";
var WORD = `[${UP}][${LO}${UP}\\-]+`;
function normDia(s) {
  return s.replace(/ş/g, "\u0219").replace(/Ş/g, "\u0218").replace(/ţ/g, "\u021B").replace(/Ţ/g, "\u021A");
}
function cleanText(s) {
  s = normDia(s);
  s = s.replace(/\\\*+/g, "\xA4");
  s = s.replace(/[*#]+/g, " ");
  s = s.replace(/\\(.)/g, "$1");
  s = s.replace(/¤(?:\s*¤)+/g, "\xA4");
  s = s.replace(/\s+/g, " ");
  return s.trim();
}
function titleCaseIfUpper(s) {
  const letters = s.replace(/[^A-Za-zĂÎÂȘȚăîâșț]/g, "");
  if (!letters || letters !== letters.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s\-])([a-zăîâșț])/g, (_, a, b) => a + b.toUpperCase());
}
var SUP = { "1": "\xB9", "2": "\xB2", "3": "\xB3" };
var SUP_ARTS = /* @__PURE__ */ new Set(["264", "364", "217"]);
function fmtArticle(num, sub) {
  if (!sub && num.length === 4 && SUP_ARTS.has(num.slice(0, 3))) {
    sub = num.slice(3);
    num = num.slice(0, 3);
  }
  return sub ? num + (SUP[sub] ?? `/${sub}`) : num;
}
function articleFromName(s) {
  const m = /Art(?:icol\w*)?\.?\s*(\d{2,4})(?:\s*[\[\/]\s*(\d)\s*\]?|\s+(\d)(?=\s+(?:alin|al\b|CP|Cod)))?/i.exec(s);
  return m ? fmtArticle(m[1], m[2] || m[3]) : void 0;
}
function articleFromText(t) {
  const head = t.slice(0, 6e3);
  const m = /prevăzut\w*\s+(?:de|la|în)\s+(.{0,260})/i.exec(head);
  if (!m) return void 0;
  let seg = m[1];
  const cut = seg.search(/\b(?:Cod\w*|CP)\b/);
  if (cut > 0) seg = seg.slice(0, cut);
  const nums = [];
  const re = /(?<![\d\w])(\d{2,4})(?:\s*[\[\/]\s*(\d)\s*\]?|\s+(\d)(?=\s+(?:alin|al\b)))?(?=[\s,.)\[]|$)/g;
  let x;
  while (x = re.exec(seg)) {
    if (/^\s*(?:ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)/i.test(seg.slice(x.index + x[0].length))) continue;
    nums.push(fmtArticle(x[1], x[2] || x[3]));
  }
  if (!nums.length) return void 0;
  const main2 = nums.find((n) => parseInt(n, 10) > 50);
  return main2 ?? nums[0];
}
function ddmmyyyy(iso) {
  if (!iso) return void 0;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : void 0;
}
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function splitName(fileName) {
  let n = normDia(fileName).replace(/\.md$/i, "");
  const m = /\s+(\d{4}-\d{2}-\d{2})\s*$/.exec(n);
  let date;
  if (m) {
    date = m[1];
    n = n.slice(0, m.index);
  }
  return { base: n.trim(), date };
}
function shorten(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:-]+$/, "") + "\u2026";
}
function detectTipAct(t) {
  const re = /(S\s?E\s?N\s?T\s?I\s?N\s?[ȚT]\s?[ĂA])|(D\s?E\s?C\s?I\s?Z\s?I\s?E(?![A-Z]))|(Î\s?N\s?C\s?H\s?E\s?I\s?E\s?R\s?E)|(H\s?O\s?T\s?[ĂA]\s?R\s?[ÎÂI]\s?R\s?E)/;
  const m = re.exec(t.slice(0, 3e3));
  if (!m) return void 0;
  if (m[1]) return "Sentin\u021B\u0103";
  if (m[2]) return "Decizie";
  if (m[3]) return "\xCEncheiere";
  return "Hot\u0103r\xEEre";
}
function normTip(s) {
  if (!s) return void 0;
  const l = normDia(s).toLowerCase();
  if (l.startsWith("sentin")) return "Sentin\u021B\u0103";
  if (l.startsWith("deciz")) return "Decizie";
  if (l.startsWith("\xEEnch") || l.startsWith("inch")) return "\xCEncheiere";
  if (l.startsWith("hot")) return "Hot\u0103r\xEEre";
  return s;
}
function detectDosar(t) {
  const head = t.slice(0, 900);
  const m = /\b(\d{1,2}[a-zA-Z]{0,2})\s*[-–]\s*(\d{1,5})\s*\/\s*(\d{2,4})\b/.exec(head);
  if (m) return `${m[1]}-${m[2]}/${m[3]}`;
  const d = /Dosarul?\s+nr\.?\s*([^\s¤][^\s]*)/i.exec(head);
  if (d && !d[1].includes("\xA4") && /\d/.test(d[1])) return d[1].replace(/[;,.]$/, "");
  return void 0;
}
var CITY = `(?:\xA4|${WORD})`;
var SEDIU = `(?:\\s*[,(]?\\s*[Ss]edi(?:ul|u)\\s+(${WORD}(?:\\s*\\([^)]{1,30}\\))?))?`;
function fmtCourt(city, sediu) {
  let s = `Judec\u0103toria ${city}`;
  if (sediu) s += ` (sediul ${sediu.replace(/\s*\(([^)]*)\)/, ", $1")})`;
  return s;
}
var CHISINAU_SEDII = /* @__PURE__ */ new Set(["Buiucani", "R\xEE\u0219cani", "Botanica", "Ciocana"]);
function detectFirstInstance(t, nominativeOnly) {
  const re = new RegExp(`Judec\u0103tori${nominativeOnly ? "a" : "(?:a|ei)"}\\s+(${CITY})${SEDIU}`, "g");
  let m;
  const head = t.slice(0, 3500);
  while (m = re.exec(head)) {
    let city = m[1] === "\xA4" ? void 0 : m[1];
    let sediu = m[2];
    if (sediu && /^¤/.test(sediu)) sediu = void 0;
    if (!city && sediu && CHISINAU_SEDII.has(sediu)) city = "Chi\u0219in\u0103u";
    if (city) return { city, sediu, text: fmtCourt(city, sediu) };
  }
  return {};
}
var CA_BY_FIRST = {
  "Chi\u0219in\u0103u": "Chi\u0219in\u0103u",
  Ungheni: "Chi\u0219in\u0103u",
  Str\u0103\u0219eni: "Chi\u0219in\u0103u",
  Ialoveni: "Chi\u0219in\u0103u",
  "B\u0103l\u021Bi": "B\u0103l\u021Bi",
  Soroca: "B\u0103l\u021Bi",
  "Edine\u021B": "B\u0103l\u021Bi",
  Briceni: "B\u0103l\u021Bi",
  Drochia: "B\u0103l\u021Bi",
  Cahul: "Cahul",
  Cantemir: "Cahul",
  Taraclia: "Cahul",
  Comrat: "Comrat"
};
function detectAppeal(t) {
  const head = t.slice(0, 3500);
  if (/Curtea Supremă de Justiție|Colegiul[^.]{0,40}lărgit/i.test(head.slice(0, 1500))) return "Curtea Suprem\u0103 de Justi\u021Bie";
  let m = new RegExp(`Cur(?:\u021Bile|tea|\u021Bii)\\s+de\\s+Apel\\s+(${WORD}(?:\\s+(?:${WORD}))?)`).exec(head);
  if (m) {
    let city = m[1].split(/\s+/)[0];
    return `Curtea de Apel ${titleCaseIfUpper(city)}`;
  }
  m = new RegExp(`CURTEA\\s+DE\\s+APEL\\s+([${UP}]+)`).exec(head);
  if (m) return `Curtea de Apel ${titleCaseIfUpper(m[1])}`;
  return void 0;
}
function detectInstanta(t, tip) {
  const appeal = detectAppeal(t);
  if (tip === "Decizie" || tip && tip !== "Sentin\u021B\u0103" && appeal) {
    if (appeal) return appeal;
    if (tip === "Decizie") {
      const fi2 = detectFirstInstance(t, false);
      const ca = fi2.city ? CA_BY_FIRST[fi2.city] : void 0;
      return ca ? `Curtea de Apel ${ca}` : "Curtea de Apel";
    }
  }
  const fi = detectFirstInstance(t, true);
  if (fi.text) return fi.text;
  return appeal;
}
var GEN_FIX = [
  [/^Procuraturii\b/, "Procuratura"],
  [/^Agenției\b/, "Agen\u021Bia"],
  [/^Primăriei\b/, "Prim\u0103ria"],
  [/^Direcției\b/, "Direc\u021Bia"],
  [/^Inspecției\b/, "Inspec\u021Bia"],
  [/^Întreprinderii\b/, "\xCEntreprinderea"],
  [/^Companiei\b/, "Compania"],
  [/^Societății\b/, "Societatea"],
  [/^Băncii\b/, "Banca"],
  [/^Curții\b/, "Curtea"],
  [/^Casei\b/, "Casa"],
  [/^Judecătoriei\b/, "Judec\u0103toria"]
];
function fixGenitive(s) {
  for (const [re, r] of GEN_FIX) if (re.test(s)) return s.replace(re, r);
  return s;
}
function cleanParty(s, max = 60) {
  s = s.replace(/¤/g, "").replace(/\s+/g, " ").replace(/^[\s,;:.\-–"„”]+|[\s,;:.\-–"„”]+$/g, "");
  return shorten(titleCaseIfUpper(s), max);
}
function extractAccused(t) {
  const head = t.slice(0, 5e3);
  const re = new RegExp(
    `(?:\xEEn\\s+privin\u021Ba\\s+(?:lui|inculpatului)|privind\\s+condamnarea\\s+lui|privind\\s+\xEEnvinuirea\\s+lui|\xEEnvinuire\\s+a\\s+(?:lui|inculpat\\w*)|\xEEnvinuirea\\s+(?:lui|inculpat\\w*)|condamnarea\\s+lui|inculpatului|inculpatei|inculpa\u021Bii\\s+|condamnatului|\xEEnvinuitului)\\s*[:\\-\u2013]?\\s*(${WORD}(?:\\s+${WORD}){0,2})`,
    "g"
  );
  let m;
  while (m = re.exec(head)) {
    const words = m[1].split(/\s+/).filter((w) => !/^(?:Procurorul|Avocatul|Apărătorul|Cu|În|La)$/i.test(w));
    if (!words.length) continue;
    const name = cleanParty(words.join(" "));
    if (name.length >= 4) return name;
  }
  return void 0;
}
function extractCivil(t) {
  const head = t.slice(0, 6e3);
  const xm = /(?:recurent(?:ul|a)|reclamant(?:ul|a)|apelant(?:ul|a)|contestator(?:ul|a)|petiționar(?:ul|a)|solicitant(?:ul|a)|contestatorul)\s+([^,;]{3,90}?)(?=,|;|\s+reprezentat|\s+împotriva)/i.exec(head);
  if (!xm) return void 0;
  const x = cleanParty(xm[1]);
  if (x.length < 3) return void 0;
  const rest = head.slice(xm.index);
  const re = /împotriva\s+([^,;]{3,120}?)(?=,|;|\s+intervenient|\s+privind|\s+prin\b|\s+cu\s+participarea)/gi;
  let ym;
  let y;
  let after = 0;
  while (ym = re.exec(rest)) {
    if (/^(?:încheier|hotărâ|hotărî|deciz|sentin|actului|ordinului|dispoziți)/i.test(ym[1])) continue;
    y = cleanParty(fixGenitive(ym[1]));
    after = ym.index + ym[0].length;
    break;
  }
  let obj;
  const om = /privind\s+([^,.;]{5,120})/i.exec(rest.slice(after));
  if (om) {
    obj = om[1].split(/\s+(?:aplicat|în cadrul|din\s|de către|\()/)[0].trim();
    obj = shorten(obj, 60).replace(/[\s,;:-]+$/, "");
  }
  const parti = y ? `${x} c. ${y}` : x;
  return { title: obj ? `${parti} \u2014 ${obj}` : parti, parti };
}
function isPenal(t) {
  return /cauza\s+penal[ăa]|învinuire|inculpat|condamnarea\s+lui/i.test(t.slice(0, 2500));
}
function multipleDefendants(t) {
  const head = t.slice(0, 3e3);
  const m = /(?:învinuire\s+a|învinuirea)\s+inculpaților|inculpaților\s*:/i.exec(head);
  return !!m;
}
function buildMeta(fileId, fileName, text, a) {
  const { base, date: nameDate } = splitName(fileName);
  const t = text ? cleanText(text) : "";
  const tipAct = normTip(a.tip_act) || (t ? detectTipAct(text ? normDia(text).replace(/\\\*/g, "").replace(/[*#]+/g, " ") : t) : void 0);
  const instanta = a.instanta ? normDia(a.instanta) : t ? detectInstanta(t, tipAct) : void 0;
  const dosar = a.dosar || (t ? detectDosar(t) : void 0);
  const data = nameDate || (a.data && /^\d{4}-\d{2}-\d{2}/.test(a.data) ? a.data.slice(0, 10) : void 0);
  const isUuid = UUID_RE.test(base);
  let person = base;
  const cutRe = /[\s-]+(?:Art(?:icolul)?\.?\s*\d|în\s+comiterea|în\s+săvârșirea|în\s+săvîrșirea)/i;
  const cm = cutRe.exec(base);
  if (cm) person = base.slice(0, cm.index);
  person = person.replace(/[\s,;:\-–]+$/, "").replace(/\s+/g, " ").trim();
  const articol = a.articol ? String(a.articol) : articleFromName(base) || (t ? articleFromText(t) : void 0);
  const artStr = articol ? `art. ${articol.replace(/^art\.?\s*/i, "")} CP` : void 0;
  let title;
  let parti;
  if (a.titlu && a.titlu.trim()) {
    title = shorten(normDia(a.titlu.trim()), 160);
  } else if (!isUuid && person && !/^\d+$/.test(person)) {
    parti = titleCaseIfUpper(person);
    const saa = t && parti.split(" ").length <= 3 && multipleDefendants(t) ? " \u0219.a." : "";
    title = shorten(parti, 130) + saa + (artStr ? ` \u2014 ${artStr}` : "");
  } else if (t) {
    if (isPenal(t)) {
      const acc = extractAccused(t);
      if (acc) {
        parti = acc;
        title = acc + (multipleDefendants(t) ? " \u0219.a." : "") + (artStr ? ` \u2014 ${artStr}` : "");
      }
    } else {
      const c = extractCivil(t);
      if (c) {
        title = c.title;
        parti = c.parti;
      }
    }
    if (!title) {
      const c = !isPenal(t) ? void 0 : extractCivil(t);
      if (c) {
        title = c.title;
        parti = c.parti;
      }
    }
  }
  if (!title) {
    const bits = [tipAct, instanta].filter(Boolean).join(" ");
    title = bits ? `${bits}${dosar ? `, dosar ${dosar}` : ""}` : base || fileName;
    if (!bits && dosar) title = `${base}, dosar ${dosar}`;
  }
  title = title.replace(/¤/g, "").replace(/\*+/g, "").replace(/\s+/g, " ").trim() || base || fileName;
  const subtitle = [tipAct, instanta, dosar ? `dosar ${dosar}` : void 0, ddmmyyyy(data)].filter(Boolean).join(" \xB7 ");
  const meta = { fileId, fileName, title, subtitle };
  if (tipAct) meta.tipAct = tipAct;
  if (instanta) meta.instanta = instanta;
  if (dosar) meta.dosar = dosar;
  if (data) meta.data = data;
  if (a.materie) meta.materie = a.materie;
  if (articol) meta.articol = articol;
  if (parti) meta.parti = parti;
  return meta;
}
async function readHead(fileName) {
  try {
    const fh = await fs.open(path.join(
      /*turbopackIgnore: true*/
      DOCS_DIR(),
      fileName
    ), "r");
    try {
      const buf = Buffer.alloc(READ_BYTES);
      const { bytesRead } = await fh.read(buf, 0, READ_BYTES, 0);
      return buf.subarray(0, bytesRead).toString("utf8");
    } finally {
      await fh.close();
    }
  } catch {
    return null;
  }
}
async function metaFor(fileId, fileName, entry) {
  const key = `${fileId}\0${fileName}`;
  const hit = metaCache.get(key);
  if (hit) return hit;
  let meta;
  try {
    const text = await readHead(fileName);
    meta = buildMeta(fileId, fileName, text, entry.attributes ?? {});
  } catch {
    const { base, date } = splitName(fileName);
    meta = { fileId, fileName, title: shorten(base || fileName, 140), subtitle: ddmmyyyy(date) ?? "" };
  }
  metaCache.set(key, meta);
  return meta;
}
async function buildAllDocMeta() {
  const st = await loadState();
  const out = {};
  for (const [id, { fileName, entry }] of st.byId) out[id] = await metaFor(id, fileName, entry);
  return out;
}

// scripts/build-doc-meta.entry.ts
function arg(name) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : void 0;
}
async function main() {
  const state = arg("state");
  const docs = arg("docs");
  const out = arg("out");
  if (!state || !docs || !out) {
    console.error("Utilizare: node build-doc-meta.mjs --state <index-state.json> --docs <folder> --out <fisier.json>");
    process.exit(1);
  }
  process.env.STATE_FILE = path2.resolve(state);
  process.env.DOCS_DIR = path2.resolve(docs);
  const meta = await buildAllDocMeta();
  const n = Object.keys(meta).length;
  await fs2.mkdir(path2.dirname(path2.resolve(out)), { recursive: true });
  await fs2.writeFile(path2.resolve(out), JSON.stringify(meta));
  console.log(`Scrise ${n} intrari in ${out}`);
  if (n === 0) console.warn("Atentie: nicio intrare (verifica --state).");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
