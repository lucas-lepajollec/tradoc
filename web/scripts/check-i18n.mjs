import { INTERFACE_LANGUAGES, translations } from '../src/i18n/translations.js';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

function flatten(value, prefix = '', output = new Map()) {
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) flatten(entry, path, output);
    else output.set(path, entry);
  }
  return output;
}

const canonical = flatten(translations.en);
const errors = [];

for (const locale of INTERFACE_LANGUAGES) {
  const localized = flatten(translations[locale] || {});
  for (const key of canonical.keys()) {
    if (!localized.has(key)) errors.push(`${locale}: missing ${key}`);
  }
  for (const key of localized.keys()) {
    if (!canonical.has(key)) errors.push(`${locale}: unexpected ${key}`);
  }
  for (const [key, value] of localized) {
    if (typeof value !== 'string' || value.trim() === '') errors.push(`${locale}: invalid value for ${key}`);
  }
}

const sourceRoot = new URL('../src', import.meta.url).pathname;
const sourceFiles = [];
const collectSourceFiles = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectSourceFiles(path);
    else if (['.js', '.jsx'].includes(extname(entry.name))) sourceFiles.push(path);
  }
};
collectSourceFiles(sourceRoot);

for (const path of sourceFiles) {
  const lines = readFileSync(path, 'utf8').split('\n');
  lines.forEach((line, index) => {
    const isLanguageSelectorState = line.includes("setLang('fr')") && line.includes("lang === 'fr'");
    if (!isLanguageSelectorState && (/lang\s*===\s*['\"]fr['\"]\s*\?/.test(line) || /const\s+fr\s*=\s*lang/.test(line))) {
      errors.push(`${path}:${index + 1}: binary EN/FR interface copy is forbidden; use t() or l()`);
    }
  });
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`${canonical.size} interface strings × ${INTERFACE_LANGUAGES.length} locales have exact key parity.`);
