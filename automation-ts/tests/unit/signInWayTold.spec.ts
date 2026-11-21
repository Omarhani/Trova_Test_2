import { expect, test } from '@playwright/test';
import { screenWayTold } from '../../src/records/signInLine';

/**
 * The row was named "Log in programmatically as Account Manager" but it signed in
 * on the screen. A sign-in on the screen tells the run its way, so the row is named by what ran.
 */
test('a sign-in on the screen tells the run its way', () => {
  const said: [string, Record<string, unknown>][] = [];
  screenWayTold((t, f) => { said.push([t, f]); });
  expect(said).toEqual([['way', { way: 'screen' }]]);
});
