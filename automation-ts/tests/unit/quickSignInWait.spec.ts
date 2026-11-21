import { expect, test } from '@playwright/test';
import { CodeWindow, CodeWindowDeps } from '../../src/web/signin/codeWindow';
import { quickFailure, quickSignInWait } from '../../src/signin/quickSignInWait';
import { saysTooSoon } from '../../src/web/signin/codeWait';

/**
 * Review of PR 988: the suite's "Log in programmatically" and the API tests sign in by the quick calls directly - the
 * app's "wait for a new code" must be waited out there too, ONCE; still refused after that = the login is refused for
 * the run (PR 980: never signed in again by a later test or worker).
 */
function clock(): { deps: CodeWindowDeps; slept: number[] } {
  let t = 1_000_000;
  const slept: number[] = [];
  return {
    slept,
    deps: {
      now: () => t,
      sleep: async (ms) => { slept.push(ms); t += ms; },
      say: () => undefined,
      lastAsked: () => undefined,
      asked: () => undefined,
      windowMs: () => 120_000,
      learn: () => undefined,
    },
  };
}

const RECIPE = { calls: [{ path: 'api/User/Login' }, { path: 'api/User/VerifyCode' }] };

test('#207 in a suite: the quick sign-in waits the app\'s code window once, then signs in', async () => {
  const c = clock();
  let tries = 0;
  const go = quickSignInWait(new CodeWindow(c.deps));
  const out = await go('Account Manager', RECIPE, async () => {
    tries += 1;
    if (tries === 1) throw new Error('A new code cannot be sent before the last one runs out');
    return 'token';
  });
  expect(out).toBe('token');
  expect(tries).toBe(2);
  expect(c.slept).toHaveLength(1);
});

test('still "wait for a new code" after the one wait = a refusal of the login, never waited again', () => {
  expect(quickFailure(new Error('A new code cannot be sent before the last one runs out'))).toBe('refused');
});

test('a network break is no refusal - the next try signs in again', () => {
  const broke = new Error('connect ECONNREFUSED 10.0.0.1:443');
  broke.name = 'FetchError';
  expect(quickFailure(broke)).toBe('break');
});

test('the code box still open after a wrong code is no "wait" - only the page\'s words saying so count', async () => {
  expect(await saysTooSoon(async () => 'The code you entered is wrong')).toBe(false);
  expect(await saysTooSoon(async () => 'Please wait before requesting a new code')).toBe(true);
  expect(await saysTooSoon(async () => { throw new Error('page closed'); })).toBe(false);
});
