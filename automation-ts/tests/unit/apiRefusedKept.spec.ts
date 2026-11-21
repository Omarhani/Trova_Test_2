import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { RunSignInBook, runSignInBook } from '../../src/signin/runSignInBook';
import { SavedSignIn } from '../../src/signin/savedSignIn';
import { signIn } from '../../src/signin/signIns';

/**
 * Review 980: the app refused the quick sign-in in worker 1, which then signed in on the screen and saved it. Worker 2
 * never runs the refused sign-in calls again (repeated refusals can lock the account): it takes the token of the
 * screen sign-in, or says plainly why it cannot.
 */
const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const TOKEN = `${part({ alg: 'none', typ: 'JWT' })}.${part({ exp: 4_000_000_000 })}.sig`;
const WHY = 'The app refused the sign-in of Admin (its calls answered 401)';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trova-refused-'));
const before = { run: process.env.TROVA_RUN_ID, mode: process.env.TROVA_MODE };

function screenSaved(token: string): SavedSignIn {
  return { origin: 'https://app.x', storage: { cookies: [], origins: [{ origin: 'https://app.x', localStorage: [{ name: 'TOKEN', value: token }] }] },
    sessionStorage: {}, madeAt: 1, fresh: 0 };
}

test.beforeEach(() => {
  process.env.TROVA_RUN_ID = `unit-refused-${process.pid}-${Date.now()}`;
  delete process.env.TROVA_MODE;
});

test.afterEach(() => {
  runSignInBook.forget();
  for (const [k, v] of [['TROVA_RUN_ID', before.run], ['TROVA_MODE', before.mode]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

test.afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

test('two workers: the screen sign-in saved after a refusal keeps the refusal of the quick sign-in', () => {
  const dir = path.join(root, 'run-1');
  const worker1 = new RunSignInBook(() => dir), worker2 = new RunSignInBook(() => dir);
  worker1.refuse('Admin', WHY);
  worker1.save('Admin', screenSaved(TOKEN));
  expect(worker2.apiRefused('admin')).toBe(WHY);
  expect(worker2.refused('Admin')).toBeUndefined(); // as before: the screen sign-in lets the later cases run
  expect(worker2.saved('Admin')).toEqual(screenSaved(TOKEN));
});

test('guard: a save with no refusal before has no refusal', () => {
  const b = new RunSignInBook(() => path.join(root, 'run-2'));
  b.save('Admin', screenSaved(TOKEN));
  expect(b.apiRefused('Admin')).toBeUndefined();
});

test('worker 2 takes the token of the screen sign-in, with no sign-in call', async () => {
  runSignInBook.refuse('Admin', WHY); // worker 1
  runSignInBook.save('Admin', screenSaved(TOKEN));
  const got = await signIn('Admin', 'web'); // worker 2: nothing in its memory
  expect(got.token).toBe(TOKEN);
  expect(got.browser.localStorage.TOKEN).toBe(TOKEN);
});

test('no token in the screen sign-in: the refusal in plain words, never the sign-in calls again', async () => {
  runSignInBook.refuse('Admin', WHY);
  runSignInBook.save('Admin', screenSaved('not-a-token'));
  const e = (await signIn('Admin', 'web').catch((x: unknown) => x)) as Error;
  expect(e.message).toContain(WHY);
  expect(e.message).not.toMatch(/recipe/i);
});
