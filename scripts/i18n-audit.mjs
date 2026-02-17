import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const DICT = join(SRC, 'i18n', 'dict.ts');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (st.isFile() && ['.ts', '.tsx'].includes(extname(full))) out.push(full);
  }
  return out;
}

function uniq(arr) {
  return [...new Set(arr)].sort();
}

const files = walk(SRC);
const used = [];
const usedRe = /\btf?\("([^"]+)"/g;
for (const f of files) {
  const txt = readFileSync(f, 'utf8');
  for (const m of txt.matchAll(usedRe)) used.push(m[1]);
}
const usedKeys = uniq(used);

const dictTxt = readFileSync(DICT, 'utf8');
const deBody = /de:\s*\{([\s\S]*?)\n\s*\},\s*en:/.exec(dictTxt)?.[1] ?? '';
const enBody = /en:\s*\{([\s\S]*?)\n\s*\},\s*\};/.exec(dictTxt)?.[1] ?? '';
const keyRe = /^\s*([A-Za-z0-9_]+)\s*:\s*["']/gm;

const deKeys = uniq([...deBody.matchAll(keyRe)].map((m) => m[1]));
const enKeys = uniq([...enBody.matchAll(keyRe)].map((m) => m[1]));

const missing = usedKeys.filter((k) => !deKeys.includes(k) || !enKeys.includes(k));
const deOnly = deKeys.filter((k) => !enKeys.includes(k));
const enOnly = enKeys.filter((k) => !deKeys.includes(k));
const unusedDe = deKeys.filter((k) => !usedKeys.includes(k));
const unusedEn = enKeys.filter((k) => !usedKeys.includes(k));

console.log(`USED_KEYS=${usedKeys.length}`);
console.log(`DE_KEYS=${deKeys.length}`);
console.log(`EN_KEYS=${enKeys.length}`);
console.log(`MISSING_IN_DICT=${missing.length}`);
for (const k of missing) console.log(`MISSING: ${k}`);
console.log(`DE_ONLY=${deOnly.length}`);
for (const k of deOnly) console.log(`DE_ONLY_KEY: ${k}`);
console.log(`EN_ONLY=${enOnly.length}`);
for (const k of enOnly) console.log(`EN_ONLY_KEY: ${k}`);
console.log(`UNUSED_DE=${unusedDe.length}`);
for (const k of unusedDe) console.log(`UNUSED_DE_KEY: ${k}`);
console.log(`UNUSED_EN=${unusedEn.length}`);
for (const k of unusedEn) console.log(`UNUSED_EN_KEY: ${k}`);
