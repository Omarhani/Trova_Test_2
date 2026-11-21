import { expect, test } from '@playwright/test';
import { Page } from '@playwright/test';
import { apiSignInShown } from '../../src/web/signin/apiSignInShown';

type Said = Record<string, unknown>[];
const sayInto = (said: Said) => (_t: string, f: Record<string, unknown>) => { said.push(f); };

/**
 * The quick sign-in was refused before any page step, and every test showed
 * "No steps were recorded". A quick sign-in is a step of the run page too, and where it stopped, with the app's words.
 */
test('#1283: a refused quick sign-in shows its step and where it stopped', async () => {
  const said: Said = [];
  await expect(apiSignInShown({} as Page, 'Account Manager', async () => { throw new Error('The app refused the sign-in'); }, sayInto(said)))
    .rejects.toThrow('The app refused the sign-in');
  expect(said.map((s) => `${s.a} ${s.e}`)).toEqual(['Log in programmatically as Account Manager', 'sign-in stopped The app refused the sign-in']);
});

test('a quick sign-in that works shows one step, no stop line', async () => {
  const said: Said = [];
  expect(await apiSignInShown({} as Page, 'Admin', async () => null, sayInto(said))).toBeNull();
  expect(said.map((s) => `${s.a} ${s.e}`)).toEqual(['Log in programmatically as Admin']);
});

test('a "not signed in" answer is a stop line too', async () => {
  const said: Said = [];
  expect(await apiSignInShown({} as Page, 'Admin', async () => 'the app showed its sign-in page', sayInto(said))).toBe('the app showed its sign-in page');
  expect(said.map((s) => `${s.a} ${s.e}`)).toEqual(['Log in programmatically as Admin', 'sign-in stopped the app showed its sign-in page']);
});
