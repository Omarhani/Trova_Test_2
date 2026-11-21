import { expect, test } from '@playwright/test';
import { apiRefusal, appName, codeTooSoon, refusalWords } from '../../src/web/signin/signInRefusal';
import { SignOutSigns, saysSignedOut } from '../../src/web/signin/signOutSigns';

/** Java utils.SignInRefusal + SignOutSigns: a refused sign-in in the app's own words; the calls that say it ran out. */

test('a refusal says the app and its own reason, without the call name', () => {
  expect(refusalWords('Shop', 'The app refused the call Account/Login: you are blocked', true, () => true))
    .toBe('Shop refused: you are blocked');
});

test('a wrong user name or password points to Test Data - Credentials', () => {
  expect(refusalWords('Shop', 'Invalid username or password', false, () => true))
    .toBe('Shop refused: Invalid username or password - fix the login in Test Data → Credentials');
});

test('Arabic reasons are said in English with the app\'s own words kept', () => {
  expect(refusalWords('Shop', 'لا تملك صلاحية تسجيل الدخول', false, () => true))
    .toBe('Shop refused: you don\'t have permission to sign in ("لا تملك صلاحية تسجيل الدخول")');
});

test('an API refusal with no fixed headers points to Test Data - Environments - API headers', () => {
  expect(refusalWords('Shop', 'Account/Login answered HTTP 401', true, () => false))
    .toContain('add them in Test Data → Environments → API headers');
  expect(refusalWords('Shop', 'Account/Login answered HTTP 401', true, () => true)).toBe('Shop refused: Account/Login answered HTTP 401');
});

test('no message from the app is never "refused" and never the login\'s fault', () => {
  expect(refusalWords('Shop', '', false, () => true)).toBe('The sign-in did not get through - try again');
  expect(refusalWords('', 'no', false, () => true)).toBe('The app refused: no');
});

test('a code asked too soon is told apart (English and Arabic)', () => {
  expect(codeTooSoon('You cannot resend the code before 60 seconds')).toBe(true);
  expect(codeTooSoon('لا يمكن إعادة الإرسال قبل دقيقة')).toBe(true);
  expect(codeTooSoon('wrong code')).toBe(false);
});

test('the app\'s name comes from its web address', () => {
  expect(appName('https://portal.shop.test/login')).toBe('Shop');
  expect(appName('https://hr-test.example.com')).toBe('Hr');
  expect(appName('not an address')).toBe('The app');
});

test('401 with no body, or 401 / 403 with an expired-token message, says the sign-in ran out', () => {
  expect(saysSignedOut(401, '')).toBe(true);
  expect(saysSignedOut(403, '{"message":"Token expired"}')).toBe(true);
  expect(saysSignedOut(403, '')).toBe(false);
  expect(saysSignedOut(403, '{"message":"No right to this branch"}')).toBe(false);
  expect(saysSignedOut(500, 'token expired')).toBe(false);
});

test('a sign-out sign counts only within the time asked', () => {
  let now = 1_000_000;
  const signs = new SignOutSigns(() => now);
  expect(signs.within(30_000)).toBe(false);
  signs.note(401, undefined);
  now += 30_000;
  expect(signs.within(30_000)).toBe(true);
  now += 1;
  expect(signs.within(30_000)).toBe(false);
});

test('the last refusal the app answered is its own message, only when it came after the sign-in began', () => {
  let now = 5_000;
  const signs = new SignOutSigns(() => now);
  signs.note(400, '{"Message":"Account is locked"}');
  expect(signs.lastRefusal(4_000)).toBe('Account is locked');
  expect(signs.lastRefusal(6_000)).toBe('');
  now = 7_000;
  signs.note(200, '{"Message":"ok"}');
  expect(signs.lastRefusal(4_000)).toBe('Account is locked');
});

test('an API sign-in\'s error is said once in plain words - never twice', () => {
  const once = apiRefusal('Shop', 'The app refused the call Account/Login: blocked', () => true);
  expect(once).toBe('Shop refused: blocked');
  expect(apiRefusal('Shop', once, () => true)).toBe(once);
  expect(apiRefusal('Shop', 'The sign-in did not get through - try again', () => true)).toBe('The sign-in did not get through - try again');
});

test('an API sign-in error that is not the app\'s refusal stays as it is (a missing field, no answer, no recipe)', () => {
  for (const m of ['The login has no Password - add it in Test Data > Credentials', 'The call /api/login did not answer (TimeoutError)',
    'Trova has no sign-in recipe for "sam" on Test']) {
    expect(apiRefusal('Shop', m, () => true)).toBe(m);
  }
  expect(apiRefusal('Shop', 'Account/Login answered HTTP 403', () => true)).toBe('Shop refused: Account/Login answered HTTP 403');
});
