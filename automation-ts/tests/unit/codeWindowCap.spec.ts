import { expect, test } from '@playwright/test';
import { CodeWindow, CodeWindowDeps } from '../../src/web/signin/codeWindow';
import { usesCode } from '../../src/web/signin/codeWait';

/**
 * Review of PR 988: a wait is never longer than the login's window (a clock that is off, a time far ahead), a time the
 * app names over 15 minutes fails with the app's words, and only a sign-in that really asks a code is recorded as one.
 */
class Clock {
  t = 1_000_000;
  slept: number[] = [];
  asked: number[] = [];
  last: number | undefined;

  deps(windowMs: number | undefined = 120_000): CodeWindowDeps {
    return {
      now: () => this.t,
      sleep: async (ms) => { this.slept.push(ms); this.t += ms; },
      say: () => undefined,
      lastAsked: () => this.last,
      asked: (_l, at) => { this.asked.push(at); },
      windowMs: () => windowMs,
      learn: () => undefined,
    };
  }
}

test('a code request "in the future" (a clock that is off) waits at most the window, never hours', async () => {
  const c = new Clock();
  c.last = c.t + 3_600_000;
  await new CodeWindow(c.deps()).run('Admin', async () => 'in', async () => false);
  expect(c.slept).toHaveLength(1);
  expect(c.slept[0]).toBeLessThanOrEqual(125_000);
});

test('the app names more than 15 minutes - fails at once with the app\'s words, no wait', async () => {
  const c = new Clock();
  const said = 'Please wait 60 minutes before requesting a new code';
  await expect(new CodeWindow(c.deps(undefined)).run('Admin', async () => { throw new Error(said); }, async () => false)).rejects.toThrow(said);
  expect(c.slept).toEqual([]);
});

test('a sign-in that asks no code is not recorded as a code request, and waits nothing before', async () => {
  const c = new Clock();
  c.last = c.t - 10_000;
  await new CodeWindow(c.deps()).run('Admin', async () => 'in', async () => false, false);
  expect(c.asked).toEqual([]);
  expect(c.slept).toEqual([]);
});

test('a sign-in recipe with a code step asks a code; one with only user name and password does not', () => {
  expect(usesCode({ calls: [{ path: 'api/User/Login' }, { path: 'api/User/VerifyCode', body: { code: '{{login:OTP}}' } }] })).toBe(true);
  expect(usesCode({ steps: [{ action: 'type', field: 'One-time code' }] })).toBe(true);
  expect(usesCode({ calls: [{ path: 'api/Account/GetAccountIdByCode' }, { path: 'api/User/Login', body: { password: '{{login:Password}}' } }] })).toBe(false);
});
