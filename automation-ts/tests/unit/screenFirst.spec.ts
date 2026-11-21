import { expect, test } from '@playwright/test';
import { screenFirst, ScreenFirstDeps } from '../../src/signin/screenFirst';
import { SavedSignIn } from '../../src/signin/savedSignIn';
import { runSignInBook } from '../../src/signin/runSignInBook';
import { setScreenFirst, signIn } from '../../src/signin/signIns';

/**
 * The suite's "Log in programmatically" block once signed in by the app's calls although no
 * quick sign-in was proven and "On the screen" was chosen - the app refused it and every case was skipped. With no proven
 * quick sign-in and the screen's steps known, the run's one sign-in is made on the screen (its whole browser state kept)
 * and the app's calls use its token. A proven quick sign-in runs as before.
 */
const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const TOKEN = `${part({ alg: 'none', typ: 'JWT' })}.${part({ exp: 4_000_000_000 })}.sig`;

function saved(token: string): SavedSignIn {
  return { origin: 'https://app.x', storage: { cookies: [], origins: [{ origin: 'https://app.x', localStorage: [{ name: 'TOKEN', value: token }] }] },
    sessionStorage: {}, madeAt: 1, fresh: 0 };
}

function deps(proven: boolean, screen: boolean, made?: SavedSignIn): ScreenFirstDeps & { opened: string[] } {
  let book = made;
  const opened: string[] = [];
  return {
    opened,
    apiProven: () => proven,
    screenKnown: () => screen,
    saved: () => book,
    openOnScreen: async (login) => { opened.push(login); book = saved(TOKEN); },
    recipe: () => undefined,
  };
}

test('no proven quick sign-in: signs in once on the screen and gives its token', async () => {
  const d = deps(false, true);
  const got = await screenFirst('Account Manager', d);
  expect(d.opened).toEqual(['Account Manager']);
  expect(got?.token).toBe(TOKEN);
  expect(got?.browser.localStorage.TOKEN).toBe(TOKEN);
});

test('the screen sign-in made earlier in the run is reused - never a second one', async () => {
  const d = deps(false, true, saved(TOKEN));
  expect((await screenFirst('Account Manager', d))?.token).toBe(TOKEN);
  expect(d.opened).toEqual([]);
});

test('the screen sign-in holds no token: plain words, never the quick sign-in', async () => {
  const d = deps(false, true, saved('not-a-token'));
  const e = (await screenFirst('Account Manager', d).catch((x: unknown) => x)) as Error;
  expect(e.message).toMatch(/sign-in made on the screen/);
  expect(e.message).not.toMatch(/\bAPI\b|recipe/);
});

test('guard: a proven quick sign-in runs as before (no screen)', async () => {
  const d = deps(true, true);
  expect(await screenFirst('Admin', d)).toBeUndefined();
  expect(d.opened).toEqual([]);
});

test('signIn uses the screen-first sign-in once it is set, and never when none is set', async () => {
  const before = { run: process.env.TROVA_RUN_ID, mode: process.env.TROVA_MODE };
  process.env.TROVA_RUN_ID = `unit-screen-first-${process.pid}-${Date.now()}`;
  delete process.env.TROVA_MODE;
  try {
    const d = deps(false, true);
    setScreenFirst(d);
    expect((await signIn('Account Manager', 'web')).token).toBe(TOKEN);
    expect(d.opened).toEqual(['Account Manager']);
    setScreenFirst(undefined);
    await signIn('Sara', 'web').catch(() => undefined); // the quick sign-in as before (no run file here)
    expect(d.opened).toEqual(['Account Manager']);
  } finally {
    setScreenFirst(undefined);
    runSignInBook.forget();
    for (const [k, v] of [['TROVA_RUN_ID', before.run], ['TROVA_MODE', before.mode]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test('guard: no saved screen steps - the quick sign-in as before', async () => {
  const d = deps(false, false);
  expect(await screenFirst('Admin', d)).toBeUndefined();
  expect(d.opened).toEqual([]);
});
