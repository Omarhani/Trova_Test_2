import { expect, test } from '@playwright/test';
import { screenFirst, ScreenFirstDeps } from '../../src/signin/screenFirst';
import { SavedSignIn } from '../../src/signin/savedSignIn';

/**
 * Writer session #355 (#206 / #207): "Log in programmatically" of a check run signed in again from zero although the
 * writer's sign-in was kept by Trova. HARD RULE one login per run: a kept sign-in goes first (the run's one browser opens
 * with it and proves it), its token is the app calls' token - even when a quick sign-in recipe is known.
 */
const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const TOKEN = `${part({ alg: 'none', typ: 'JWT' })}.${part({ exp: 4_000_000_000 })}.sig`;

function saved(): SavedSignIn {
  return { origin: 'https://app.x', storage: { cookies: [], origins: [{ origin: 'https://app.x', localStorage: [{ name: 'TOKEN', value: TOKEN }] }] },
    sessionStorage: {}, madeAt: 1, fresh: 0 };
}

function deps(proven: boolean, kept: boolean): ScreenFirstDeps & { opened: string[] } {
  let book: SavedSignIn | undefined;
  const opened: string[] = [];
  return {
    opened,
    apiProven: () => proven,
    screenKnown: () => false,
    kept: () => kept,
    saved: () => book,
    openOnScreen: async (login) => { opened.push(login); book = saved(); },
    recipe: () => undefined,
  };
}

test('#206: a kept sign-in goes first - the run opens with it and its token is used, even with a quick sign-in known', async () => {
  const d = deps(true, true);
  expect((await screenFirst('Account Manager', d))?.token).toBe(TOKEN);
  expect(d.opened).toEqual(['Account Manager']);
});

test('the gate\'s own quick sign-in inside the kept try is never sent back to the kept try (no loop)', async () => {
  const d = deps(true, true);
  let inner: unknown = 'not asked';
  d.openOnScreen = async (login) => { d.opened.push(login); inner = await screenFirst(login, d); };
  await screenFirst('Admin', d).catch(() => undefined);
  expect(inner).toBeUndefined();
  expect(d.opened).toEqual(['Admin']);
});

test('guard: none kept and a quick sign-in known - the quick sign-in as before', async () => {
  const d = deps(true, false);
  expect(await screenFirst('Admin', d)).toBeUndefined();
  expect(d.opened).toEqual([]);
});
