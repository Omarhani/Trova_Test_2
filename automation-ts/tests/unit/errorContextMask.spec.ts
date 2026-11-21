import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { maskErrorContexts, maskSnapshot } from '../../src/report/errorContextMask';

/**
 * The page snapshot Playwright left on the client's computer next to the failed
 * sign-in (error-context.md) held the typed password in plain text. Every secret there is *** now.
 */
const BLOCK_FORM = [
  '        - generic [ref=e22]:',
  '            - textbox [ref=e25]:',
  '              - /placeholder: كلمة السر',
  '              - text: Fake-Pass-1',
  '            - button [ref=e26] [cursor=pointer]',
  '        - textbox [ref=e21]:',
  '          - /placeholder: الهاتف أو البريد الإلكتروني',
  '          - text: someone@example.test',
].join('\n');

test('#206: the password typed in a box named by its hint is masked; the user name box is left', () => {
  const out = maskSnapshot(BLOCK_FORM, []);
  expect(out).not.toContain('Fake-Pass-1');
  expect(out).toContain('- text: ***');
  expect(out).toContain('someone@example.test');
});

test('#207: the inline form ("textbox "Password" [ref]: value") is masked too', () => {
  const out = maskSnapshot('  - textbox "كلمة السر" [ref=e25]: Fake-Pass-2\n  - textbox "Password" [ref=e9]: Fake-Pass-3', []);
  expect(out).not.toMatch(/Fake-Pass/);
});

test('any secret value of the run\'s logins is masked wherever it shows', () => {
  expect(maskSnapshot('- paragraph: said Fake-Pass-4 here', ['Fake-Pass-4'])).toBe('- paragraph: said *** here');
});

test('the failed test\'s error-context.md is rewritten on disk; other attachments are left', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-'));
  const file = path.join(dir, 'error-context.md');
  const other = path.join(dir, 'trace.txt');
  fs.writeFileSync(file, BLOCK_FORM);
  fs.writeFileSync(other, 'Fake-Pass-1');
  maskErrorContexts([{ name: 'error-context', path: file }, { name: 'trace', path: other }], () => []);
  expect(fs.readFileSync(file, 'utf8')).not.toContain('Fake-Pass-1');
  expect(fs.readFileSync(other, 'utf8')).toBe('Fake-Pass-1');
  fs.rmSync(dir, { recursive: true, force: true });
});
