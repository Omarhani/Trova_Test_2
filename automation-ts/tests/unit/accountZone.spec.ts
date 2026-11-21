import { expect, test } from '@playwright/test';
import { accountOffsetMin } from '../../src/data/accountZone';

/** The account's clock is the project's own: never one app's fixed time zone or phone headers. */
test('the run states the account time zone in minutes east of UTC', () => {
  expect(accountOffsetMin({ TROVA_TIME_ZONE_OFFSET_MIN: '180' }, () => 0)).toBe(180);
  expect(accountOffsetMin({ TROVA_TIME_ZONE_OFFSET_MIN: '-300' }, () => 0)).toBe(-300);
});

test('with nothing stated it is the computer\'s own time zone', () => {
  expect(accountOffsetMin({}, () => -120)).toBe(120);
  expect(accountOffsetMin({ TROVA_TIME_ZONE_OFFSET_MIN: 'x' }, () => 60)).toBe(-60);
});
