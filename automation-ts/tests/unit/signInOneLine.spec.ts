import { expect, test } from '@playwright/test';
import { signInDoneLine } from '../../src/records/signInLine';
import { openShown } from '../../src/web/signin/signInOpenShown';

/**
 * A writer's check: the sign-in test's steps said the same thing twice - "Opened the app signed in as Account
 * Manager ✓" and "Log in programmatically as Account Manager ✓" - and it had no picture. One line now, "Signed in as
 * Account Manager in the background ✓", and the picture of the app after the sign-in. A sign-in on the screen keeps
 * its lines as before.
 */

function fakes(onScreen: boolean) {
  const checks: string[] = [];
  const pictures: string[] = [];
  const deps = { onScreen: () => onScreen, check: (text: string) => checks.push(text), picture: async () => { pictures.push('after sign-in'); } };
  const open = async (proved: (login: string) => void): Promise<void> => { proved('Account Manager'); };
  return { checks, pictures, deps, open };
}

test('a sign-in in the background shows one line and the picture of the app', async () => {
  const f = fakes(false);
  await openShown('Account Manager', f.open, f.deps);
  f.checks.push(signInDoneLine('Account Manager', false)); // the sign-in test's own line
  expect(f.checks).toEqual(['Signed in as Account Manager in the background']);
  expect(f.pictures).toEqual(['after sign-in']);
});

test('a sign-in on the screen keeps its lines as before', async () => {
  const f = fakes(true);
  await openShown('Account Manager', f.open, f.deps);
  f.checks.push(signInDoneLine('Account Manager', true));
  expect(f.checks).toEqual(['Opened the app signed in as Account Manager', 'Sign in on the screen as Account Manager']);
});
