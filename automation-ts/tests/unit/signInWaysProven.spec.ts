import { expect, test } from '@playwright/test';
import { apiProven, quickKnown } from '../../src/web/signin/signInWays';

/**
 * Review 980: a sign-in recipe Trova only prefilled from a seed is not proven on this app - the run signs in on the
 * screen, unless Trova's shared sign-in worked. A learned or added recipe stays proven, as before.
 */
const OK = { token: 't', browser: { localStorage: {}, sessionStorage: {}, cookies: {} } };
const ways = (shared: () => typeof OK | undefined, source?: string) => ({
  shared,
  recipe: () => ({ calls: [{ method: 'POST', path: '/login' }], token: 't', ...(source === undefined ? {} : { source }) }),
});

test('a prefilled recipe is not proven', () => {
  expect(apiProven('Admin', ways(() => undefined, 'Prefilled'))).toBe(false);
  expect(apiProven('Admin', ways(() => undefined, 'Prefilled (seed 3)'))).toBe(false);
});

test('a prefilled recipe with Trova\'s shared sign-in working is proven', () => {
  expect(apiProven('Admin', ways(() => OK, 'Prefilled'))).toBe(true);
});

test('guard: a learned or added recipe, or one from an older server with no source, stays proven', () => {
  expect(apiProven('Admin', ways(() => undefined, 'Learned'))).toBe(true);
  expect(apiProven('Admin', ways(() => undefined, 'Added'))).toBe(true);
  expect(apiProven('Admin', ways(() => undefined))).toBe(true);
});

test('guard: Trova\'s shared sign-in refused = not proven', () => {
  expect(apiProven('Admin', ways(() => { throw new Error('refused'); }, 'Learned'))).toBe(false);
});

// API FIRST - any sign-in recipe Trova has (a prefilled one too) is
// tried before the screen; a suite signs in on the screen only when Trova has no recipe at all
test('#355: a prefilled recipe is a known quick sign-in (tried before the screen)', () => {
  expect(quickKnown('Admin', ways(() => undefined, 'Prefilled'))).toBe(true);
  expect(quickKnown('Admin', ways(() => undefined, 'Learned'))).toBe(true);
});

test('#355 guard: no recipe and no shared sign-in, or the shared one refused - not known', () => {
  expect(quickKnown('Admin', { shared: () => undefined, recipe: () => { throw new Error('none'); } })).toBe(false);
  expect(quickKnown('Admin', ways(() => { throw new Error('refused'); }, 'Prefilled'))).toBe(false);
});
