import { expect, test } from '@playwright/test';
import { isOneTimeLink } from '../../src/mail/oneTimeLinks';

/** A link that lets whoever has it in is hidden in the report; an ordinary link is shown. */

test('reset, verify and sign-in links are one-time links', () => {
  expect(isOneTimeLink('https://app.example.com/reset?token=abc')).toBe(true);
  expect(isOneTimeLink('https://app.example.com/account/verify?id=7&amp;code=1234')).toBe(true);
  expect(isOneTimeLink('https://app.example.com/magic/9f8e7d6c5b4a3f2e1d0c')).toBe(true);
  expect(isOneTimeLink('https://app.example.com/#/set-password?k=1')).toBe(true);
});

test('an ordinary link is not', () => {
  expect(isOneTimeLink('https://app.example.com/help')).toBe(false);
  expect(isOneTimeLink('https://app.example.com/orders/12')).toBe(false);
  expect(isOneTimeLink('not a link')).toBe(false);
});
