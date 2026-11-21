import * as fs from 'node:fs';
import { asObject, asText, section } from '../run/runDataFile';
import { MASK, secretField } from './secretValues';

/** a box whose name or hint says it holds a secret (password, code, PIN - English and Arabic) */
const SECRET_BOX = /pass(word|code)?|\bpin\b|otp|one.?time|كلمة\s*(السر|المرور)|رمز/i;
const BOX = /^(\s*)- textbox\b(.*)$/;

/**
 * The page snapshot Playwright writes next to a failed test (error-context.md) with every secret as ***: a secret box's
 * typed text (found by its name or hint) and every secret value of the run's logins. Session #355: run #206's snapshot
 * held the typed password in plain text on the client's computer. The text stays otherwise as it was.
 */
export function maskSnapshot(text: string, secrets: string[]): string {
  const lines = text.split('\n');
  let inBox = -1; // the indent of the secret box we are inside, -1 = none
  let boxAt = -1;
  for (let i = 0; i < lines.length; i++) {
    const indent = /^\s*/.exec(lines[i])![0].length;
    if (inBox >= 0 && indent <= inBox) inBox = -1;
    const box = BOX.exec(lines[i]);
    if (box) {
      boxAt = indent;
      if (SECRET_BOX.test(box[2])) inBox = indent;
      lines[i] = SECRET_BOX.test(box[2]) ? lines[i].replace(/(\]\s*:\s*)\S.*$/, `$1${MASK}`) : lines[i];
      continue;
    }
    if (boxAt >= 0 && indent > boxAt && /^\s*- \/placeholder:/.test(lines[i]) && SECRET_BOX.test(lines[i])) inBox = boxAt;
    if (inBox >= 0 && /^\s*- text:/.test(lines[i])) lines[i] = lines[i].replace(/(- text:\s*).*$/, `$1${MASK}`);
  }
  let out = lines.join('\n');
  for (const s of [...secrets].filter((v) => v.length > 1).sort((a, b) => b.length - a.length)) out = out.split(s).join(MASK);
  return out;
}

/** every secret value of the run's logins (Test Data → Credentials); none outside a Trova run */
export function loginSecrets(): string[] {
  try {
    const logins = section('logins');
    return Object.values(logins).flatMap((l) => Object.entries(asObject(l))
      .filter(([k]) => secretField(k)).map(([, v]) => asText(v)));
  } catch {
    return [];
  }
}

/** the failed test's error-context.md files rewritten with their secrets masked; one that cannot be read is left */
export function maskErrorContexts(attachments: { name: string; path?: string }[], secrets: () => string[] = loginSecrets): void {
  const files = attachments.filter((a) => a.name === 'error-context' && a.path).map((a) => a.path as string);
  if (!files.length) return;
  const known = secrets();
  for (const file of files) {
    try {
      fs.writeFileSync(file, maskSnapshot(fs.readFileSync(file, 'utf8'), known), 'utf8');
    } catch {
      // gone or locked: nothing to mask
    }
  }
}
