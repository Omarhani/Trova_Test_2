import { expect, test } from '@playwright/test';
import { SavedSignIn } from '../../src/signin/savedSignIn';
import { GateDeps, SignInGate } from '../../src/signin/signInGate';

/**
 * The app refused Trova's sign-in behind the screens and all 3 cases were not
 * tested, while the AI run signed in fine on the screen as the same login. Prod's way: with no proven sign-in call the
 * run signs in ONCE on the sign-in screen, keeps the full browser state and every case reuses it; a refused sign-in
 * behind the screens falls back to the screen once before it gives up. No extra step when the quick sign-in works.
 */
class Fakes {
  saved = new Map<string, SavedSignIn>();
  refusals = new Map<string, string>();
  held = '';
  api: string[] = [];
  screen: string[] = [];
  captures = 0;
  said: string[] = [];
  apiAnswer: string | null | Error = null;
  screenAnswer: string | null = null;

  deps(proven: boolean, screenKnown = true): GateDeps {
    return {
      mode: 'hybrid',
      book: {
        saved: (l) => this.saved.get(l),
        save: (l, s) => { this.saved.set(l, s); this.refusals.delete(l); },
        refused: (l) => this.refusals.get(l),
        refuse: (l, why) => { this.refusals.set(l, why); },
      },
      held: () => this.held,
      hold: (l) => { this.held = l; },
      byApi: async (login) => {
        this.api.push(login);
        if (this.apiAnswer instanceof Error) throw this.apiAnswer;
        return this.apiAnswer;
      },
      byScreen: async (login) => { this.screen.push(login); return this.screenAnswer; },
      apiProven: () => proven,
      screenKnown: () => screenKnown,
      browser: () => ({ kind: 'none' }),
      putBrowser: async () => {},
      capture: async () => { this.captures += 1; return { origin: 'https://app.x', storage: { cookies: [], origins: [] }, sessionStorage: {} }; },
      put: async () => {},
      prove: async () => null,
      proved: () => {},
      renewDue: () => null,
      now: () => 1_000,
      say: (l) => { this.said.push(l); },
    };
  }
}

test('no proven sign-in call: the run signs in once on the screen, keeps the full state, later cases reuse it', async () => {
  const f = new Fakes();
  const gate = new SignInGate(f.deps(false));
  await gate.open('Account Manager');
  await gate.open('Account Manager');
  await gate.open('Account Manager');
  expect(f.api).toEqual([]);
  expect(f.screen).toEqual(['Account Manager']);
  expect(f.captures).toBe(1);
  expect(f.saved.has('Account Manager')).toBe(true);
});

test('a proven sign-in call: behind the screens as before, the screen never opened', async () => {
  const f = new Fakes();
  await new SignInGate(f.deps(true)).open('Account Manager');
  expect(f.api).toEqual(['Account Manager']);
  expect(f.screen).toEqual([]);
});

test('the app refuses the sign-in behind the screens: one sign-in on the screen, and the case goes on', async () => {
  const f = new Fakes();
  f.apiAnswer = new Error("The app refused the sign-in: you don't have permission to sign in");
  const gate = new SignInGate(f.deps(true));
  await gate.open('Account Manager');
  await gate.open('Account Manager');
  expect(f.api).toEqual(['Account Manager']);
  expect(f.screen).toEqual(['Account Manager']);
  expect(f.refusals.get('Account Manager')).toBeUndefined();
  expect(f.said.join('\n')).toMatch(/on the sign-in screen/);
});

test('the screen refuses too: the plain reason once, and the later cases of the login are skipped', async () => {
  const f = new Fakes();
  f.apiAnswer = new Error("The app refused the sign-in: you don't have permission to sign in");
  f.screenAnswer = 'it went to its sign-in page';
  const gate = new SignInGate(f.deps(true));
  await expect(gate.open('Account Manager')).rejects.toThrow(/Expected: the app signed in as Account Manager/);
  await expect(gate.open('Account Manager')).rejects.toThrow();
  expect(f.screen).toEqual(['Account Manager']);
  expect(f.api).toEqual(['Account Manager']);
});

test('no saved sign-in steps for the screen: the refusal behind the screens stands, no second try', async () => {
  const f = new Fakes();
  f.apiAnswer = new Error("The app refused the sign-in: you don't have permission to sign in");
  await expect(new SignInGate(f.deps(true, false)).open('Account Manager')).rejects.toThrow(/refused the sign-in/);
  expect(f.screen).toEqual([]);
});

test('a network break behind the screens is no refusal: no screen fallback, tried again as before', async () => {
  const f = new Fakes();
  const broke = new Error('connect ECONNREFUSED 10.0.0.1:443');
  broke.name = 'FetchError';
  f.apiAnswer = broke;
  await expect(new SignInGate(f.deps(true)).open('Account Manager')).rejects.toThrow();
  expect(f.screen).toEqual([]);
  expect(f.refusals.size).toBe(0);
});

test('review 988: still "wait for a new code" after the one wait - refused at once, no screen sign-in (no new code)', async () => {
  const f = new Fakes();
  f.apiAnswer = new Error('A new code cannot be sent before the last one runs out');
  await expect(new SignInGate(f.deps(true)).open('Account Manager')).rejects.toThrow(/cannot be sent before/);
  expect(f.screen).toEqual([]);
  expect(f.refusals.get('Account Manager')).toMatch(/cannot be sent before/);
});
