import { expect, test } from '@playwright/test';
import { SavedSignIn } from '../../src/signin/savedSignIn';
import { GateDeps, SignInGate } from '../../src/signin/signInGate';
import { signInDoneLine } from '../../src/records/signInLine';

/**
 * Writer session #355: the writer signed in once on the screen, then each check run (#206, #207) signed in AGAIN from
 * zero and the app refused a second code. HARD RULE one login per run: the sign-in Trova kept (the writer's own, or an
 * earlier run's) is put back whole and proved - no new sign-in; a new one only when the kept one no longer works.
 */
class Fakes {
  saved = new Map<string, SavedSignIn>();
  screen: string[] = [];
  api: string[] = [];
  kept: string[] = [];
  said: string[] = [];
  keptThere = true;
  proveAnswers: (string | null)[] = [];

  deps(proven = false, mode: 'hybrid' | 'ui' = 'hybrid'): GateDeps {
    return {
      mode,
      book: {
        saved: (l) => this.saved.get(l),
        save: (l, s) => { this.saved.set(l, s); },
        refused: () => undefined,
        refuse: () => {},
      },
      held: () => '',
      hold: () => {},
      byApi: async (l) => { this.api.push(l); return null; },
      byScreen: async (l) => { this.screen.push(l); return null; },
      apiProven: () => proven,
      screenKnown: () => true,
      putKept: async (l) => { this.kept.push(l); return this.keptThere; },
      browser: () => ({ kind: 'none' }),
      putBrowser: async () => {},
      capture: async () => ({ origin: 'https://app.x', storage: { cookies: [], origins: [] }, sessionStorage: {} }),
      put: async () => {},
      prove: async () => (this.proveAnswers.length ? this.proveAnswers.shift()! : null),
      proved: () => {},
      renewDue: () => null,
      now: () => 1_000,
      say: (l) => { this.said.push(l); },
    };
  }
}

test('#206: the writer\'s kept sign-in still works - the check run opens with it and never signs in again', async () => {
  const f = new Fakes();
  const gate = new SignInGate(f.deps());
  await gate.open('Account Manager');
  await gate.open('Account Manager');
  expect(f.kept).toEqual(['Account Manager']);
  expect(f.screen).toEqual([]);
  expect(f.saved.has('Account Manager')).toBe(true);
  expect(f.said[0]).toContain('saved earlier');
});

test('full screen mode reuses the kept sign-in too', async () => {
  const f = new Fakes();
  await new SignInGate(f.deps(false, 'ui')).open('Admin');
  expect(f.screen).toEqual([]);
  expect(f.kept).toEqual(['Admin']);
});

test('the kept sign-in ended: one sign-in on the screen, as before', async () => {
  const f = new Fakes();
  f.proveAnswers = ['it went to its sign-in page'];
  await new SignInGate(f.deps()).open('Admin');
  expect(f.screen).toEqual(['Admin']);
});

test('a quick sign-in is known: the kept one still goes first - no sign-in call at all', async () => {
  const f = new Fakes();
  await new SignInGate(f.deps(true)).open('Admin');
  expect(f.api).toEqual([]);
  expect(f.kept).toEqual(['Admin']);
});

test('guard: the kept one ended and a quick sign-in is known - the quick sign-in once, never the screen', async () => {
  const f = new Fakes();
  f.proveAnswers = ['it went to its sign-in page'];
  await new SignInGate(f.deps(true)).open('Admin');
  expect(f.api).toEqual(['Admin']);
  expect(f.screen).toEqual([]);
});

test('guard: none kept - one sign-in on the screen', async () => {
  const f = new Fakes();
  f.keptThere = false;
  await new SignInGate(f.deps()).open('Admin');
  expect(f.screen).toEqual(['Admin']);
});

test('B: the run line names what really ran - on the screen, else programmatically (a kept one too)', async () => {
  const onScreen = new Fakes();
  onScreen.keptThere = false;
  await new SignInGate(onScreen.deps()).open('Account Manager');
  expect(onScreen.saved.get('Account Manager')?.onScreen).toBe(true);
  const kept = new Fakes();
  await new SignInGate(kept.deps()).open('Account Manager');
  expect(kept.saved.get('Account Manager')?.onScreen).toBeUndefined();
  expect(signInDoneLine('Account Manager', true)).toBe('Sign in on the screen as Account Manager');
  expect(signInDoneLine('Account Manager', false)).toBe('Signed in as Account Manager in the background');
});

test('review 988: a kept sign-in the app rejects is dropped from the kept store - later runs never try it again', async () => {
  const f = new Fakes();
  const dropped: string[] = [];
  f.proveAnswers = ['it went to its sign-in page'];
  await new SignInGate({ ...f.deps(), dropKept: (l) => { dropped.push(l); } }).open('Admin');
  expect(dropped).toEqual(['Admin']);
});

test('session #356: a quick sign-in that opens the app signed in proves the login\'s sign-in recipe - the screen never does', async () => {
  const quick = new Fakes();
  quick.keptThere = false;
  const proven: string[] = [];
  await new SignInGate({ ...quick.deps(true), quickProven: (l) => { proven.push(l); } }).open('Admin');
  expect(proven).toEqual(['Admin']);
  const screen = new Fakes();
  screen.keptThere = false;
  const none: string[] = [];
  await new SignInGate({ ...screen.deps(false), quickProven: (l) => { none.push(l); } }).open('Admin');
  expect(none).toEqual([]);
});

test('guard: a kept sign-in that works is never dropped', async () => {
  const f = new Fakes();
  const dropped: string[] = [];
  await new SignInGate({ ...f.deps(), dropKept: (l) => { dropped.push(l); } }).open('Admin');
  expect(dropped).toEqual([]);
});
