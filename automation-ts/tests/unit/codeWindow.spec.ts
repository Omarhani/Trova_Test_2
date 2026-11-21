import { expect, test } from '@playwright/test';
import { CodeWindow, CodeWindowDeps } from '../../src/web/signin/codeWindow';
import { codeTooSoon, namedWaitMs } from '../../src/web/signin/codeWait';

/**
 * For ANY app: an app that sends a one-time code allows a new one only after a
 * while. The login's "Wait between sign-in codes" (empty = no wait) and the last code request time (kept across runs)
 * make a new sign-in wait only what is left; the app saying "wait" (any language) is waited out ONCE (the time it names,
 * else the login's wait) and the sign-in made once more - an empty wait is filled with what was learned. A wrong code or
 * a locked account fails at once. Never a loop.
 */
class Clock {
  t = 1_000_000;
  slept: number[] = [];
  said: string[] = [];
  learned: number[] = [];
  asked = new Map<string, number>();

  deps(windowMs: number | null = 120_000): CodeWindowDeps {
    return {
      now: () => this.t,
      sleep: async (ms) => { this.slept.push(ms); this.t += ms; },
      say: (l) => { this.said.push(l); },
      lastAsked: (l) => this.asked.get(l),
      asked: (l, at) => { this.asked.set(l, at); },
      windowMs: () => windowMs ?? undefined,
      learn: (_l, ms) => { this.learned.push(ms); },
    };
  }
}

const total = (c: Clock) => c.slept.reduce((a, b) => a + b, 0);

test('#206: the code step waited inside the app\'s window - Trova waits, then signs in once and passes', async () => {
  const c = new Clock();
  let tries = 0;
  const signIn = async (): Promise<string> => {
    tries += 1;
    c.t += 20_000;
    if (tries === 1) throw new Error('Shop did not let the sign-in through: the app showed its sign-in page');
    return 'in';
  };
  expect(await new CodeWindow(c.deps()).run('Account Manager', signIn, async () => tries === 1)).toBe('in');
  expect(tries).toBe(2);
  expect(total(c)).toBeGreaterThanOrEqual(100_000);
  expect(c.said.join('\n')).toContain('Waiting 2 minutes - the app allows a new sign-in code only then');
});

test('#207: a code was asked a minute ago (another run) - the new run waits only what is left, then signs in once', async () => {
  const c = new Clock();
  c.asked.set('Account Manager', c.t - 60_000);
  let tries = 0;
  await new CodeWindow(c.deps()).run('Account Manager', async () => { tries += 1; return 'in'; }, async () => false);
  expect(tries).toBe(1);
  expect(c.slept[0]).toBeGreaterThanOrEqual(60_000);
  expect(c.slept[0]).toBeLessThan(70_000);
});

test('no wait set (empty) - a code asked a moment ago is not waited for before the sign-in', async () => {
  const c = new Clock();
  c.asked.set('Admin', c.t - 10_000);
  await new CodeWindow(c.deps(null)).run('Admin', async () => 'in', async () => false);
  expect(c.slept).toEqual([]);
});

test('the app names the time ("try again in 90 seconds"): that time is waited, and an empty wait learns it', async () => {
  const c = new Clock();
  let tries = 0;
  const signIn = async (): Promise<string> => {
    tries += 1;
    if (tries === 1) throw new Error('Shop refused: you cannot request a new code yet, try again in 90 seconds');
    return 'in';
  };
  await new CodeWindow(c.deps(null)).run('Admin', signIn, async () => false);
  expect(tries).toBe(2);
  expect(total(c)).toBeGreaterThanOrEqual(90_000);
  expect(total(c)).toBeLessThan(100_000);
  expect(c.learned).toEqual([90_000]);
  expect(c.said.join('\n')).toMatch(/Wait between sign-in codes.*90 seconds/);
});

test('refused again after the wait = Failed with the app\'s own words, never a third try', async () => {
  const c = new Clock();
  let tries = 0;
  const refused = new Error('Shop refused: a new one-time code cannot be sent before the last one runs out');
  await expect(new CodeWindow(c.deps()).run('Admin', async () => { tries += 1; throw refused; }, async () => false))
    .rejects.toThrow('cannot be sent before');
  expect(tries).toBe(2);
});

test('a wrong code or a locked account fails at once - never waited', async () => {
  for (const said of ['Shop refused: the verification code is incorrect', 'Shop refused: the account is locked',
    'Shop refused: wrong user name or password', 'رمز التحقق غير صحيح']) {
    const c = new Clock();
    let tries = 0;
    await expect(new CodeWindow(c.deps()).run('Admin', async () => { tries += 1; throw new Error(said); }, async () => true)).rejects.toThrow();
    expect(tries).toBe(1);
    expect(c.slept).toEqual([]);
  }
});

test('"wait before a new code" is understood in several languages; other refusals are not', () => {
  for (const s of ['لايمكنك إعادة إرسال قبل انتهاء وقت الكود السابق', 'Please wait before requesting a new code',
    'The code is still valid, try again later', 'Veuillez patienter avant de demander un nouveau code',
    'Bitte warten Sie, bevor Sie einen neuen Code anfordern', 'Espere antes de solicitar un nuevo código']) {
    expect(codeTooSoon(s), s).toBe(true);
  }
  expect(codeTooSoon('wrong user name or password')).toBe(false);
  expect(codeTooSoon('the verification code is incorrect')).toBe(false);
});

test('the time the app names, in any of the common ways', () => {
  expect(namedWaitMs('try again in 90 seconds')).toBe(90_000);
  expect(namedWaitMs('wait 2 minutes')).toBe(120_000);
  expect(namedWaitMs('حاول بعد 30 ثانية')).toBe(30_000);
  expect(namedWaitMs('انتظر ٢ دقيقة')).toBe(120_000);
  expect(namedWaitMs('please wait')).toBeUndefined();
});
