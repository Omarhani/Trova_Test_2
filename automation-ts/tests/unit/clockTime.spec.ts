import { expect, test } from '@playwright/test';
import { ClockTime } from '../../src/web/clockTime';

/** The time a test asks for, read once into what a clock dialog needs and compared with what the field shows. */

test('a 24-hour time and a 12-hour time are the same time', () => {
  const t = ClockTime.parse('18:00');
  expect([t.hour24, t.minute, t.hour12, t.pm]).toEqual([18, 0, 6, true]);
  expect(t.matches('6:00 pm')).toBe(true);
  expect(t.matches('6:00 PM')).toBe(true);
  expect(t.matches('18:00')).toBe(true);
});

test('Arabic digits and the Arabic AM / PM marks are read', () => {
  const t = ClockTime.parse('٦:٣٠ م');
  expect([t.hour24, t.minute]).toEqual([18, 30]);
  expect(ClockTime.parse('9 ص').hour24).toBe(9);
});

test('midnight and noon on a 12-hour clock', () => {
  expect(ClockTime.parse('12:00 am').hour24).toBe(0);
  expect(ClockTime.parse('12:15 pm').hour24).toBe(12);
  expect(ClockTime.parse('00:00').hour12).toBe(12);
});

test('the header shows two digits and 13-23 and 00 sit on the inner ring of a 24-hour face', () => {
  const t = ClockTime.parse('9:05 am');
  expect([t.hourHeader, t.minuteHeader]).toEqual(['09', '05']);
  expect(ClockTime.parse('18:00').innerRing24).toBe(true);
  expect(ClockTime.parse('0:00').innerRing24).toBe(true);
  expect(ClockTime.parse('12:00').innerRing24).toBe(false);
});

test('a wrong time stops in plain words', () => {
  for (const wrong of ['25:00', '10:75', '13:00 pm', '0:00 am', 'soon', '']) {
    expect(() => ClockTime.parse(wrong)).toThrow(`"${wrong}" is not a time - write it like 18:00 or 6:00 pm`);
  }
});

test('an empty or other value does not match', () => {
  const t = ClockTime.parse('18:00');
  expect(t.matches('')).toBe(false);
  expect(t.matches('6:00 am')).toBe(false);
});

test('the place of a value on the face: 12 / 0 at the top, 15 minutes at the right', () => {
  expect(ClockTime.offset(0, 60, 100)).toEqual([0, -100]);
  expect(ClockTime.offset(15, 60, 100)).toEqual([100, 0]);
  expect(ClockTime.offset(6, 12, 100)).toEqual([0, 100]);
});

test('said back as a person writes it', () => {
  expect(String(ClockTime.parse('18:05'))).toBe('6:05 pm');
});
