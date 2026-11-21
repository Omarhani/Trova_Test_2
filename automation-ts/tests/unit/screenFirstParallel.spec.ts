import { expect, test } from '@playwright/test';
import { screenFirst, ScreenFirstDeps } from '../../src/signin/screenFirst';
import { SavedSignIn } from '../../src/signin/savedSignIn';

/**
 * Review of PR 988: the kept-first guard was one flag for the whole worker - a second sign-in in the same worker while
 * the first was opening skipped the kept sign-in and signed in again. Now one open per login: the same login waits for
 * it and reuses it; another login opens its own.
 */
const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const TOKEN = `${part({ alg: 'none', typ: 'JWT' })}.${part({ exp: 4_000_000_000 })}.sig`;

function saved(): SavedSignIn {
  return { origin: 'https://app.x', storage: { cookies: [], origins: [{ origin: 'https://app.x', localStorage: [{ name: 'TOKEN', value: TOKEN }] }] },
    sessionStorage: {}, madeAt: 1, fresh: 0 };
}

function deps(): ScreenFirstDeps & { opened: string[] } {
  const book = new Map<string, SavedSignIn>();
  const opened: string[] = [];
  return {
    opened,
    apiProven: () => true,
    screenKnown: () => false,
    kept: () => true,
    saved: (l) => book.get(l),
    openOnScreen: async (login) => { opened.push(login); await new Promise((r) => setTimeout(r, 30)); book.set(login, saved()); },
    recipe: () => undefined,
  };
}

test('two logins in the same worker at once - each opens with its own kept sign-in', async () => {
  const d = deps();
  const [a, b] = await Promise.all([screenFirst('Admin', d), screenFirst('Account Manager', d)]);
  expect(a?.token).toBe(TOKEN);
  expect(b?.token).toBe(TOKEN);
  expect(d.opened.sort()).toEqual(['Account Manager', 'Admin']);
});

test('the same login twice at once - opened once, both reuse it', async () => {
  const d = deps();
  const [a, b] = await Promise.all([screenFirst('Admin', d), screenFirst('Admin', d)]);
  expect(a?.token).toBe(TOKEN);
  expect(b?.token).toBe(TOKEN);
  expect(d.opened).toEqual(['Admin']);
});
