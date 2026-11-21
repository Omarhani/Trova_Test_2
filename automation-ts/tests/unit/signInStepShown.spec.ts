import { expect, test } from '@playwright/test';
import { Page } from '@playwright/test';
import { signInStepShown, typedWords } from '../../src/web/signin/signInStepShown';

/**
 * Writer session #355: the run page of #206 / #207 said "No steps were recorded" - the sign-in on the screen now shows
 * each of its steps (open, type, click, where it stopped), a secret typed as *** and never a value.
 */
test('#206: each sign-in step is a step line of the run page', () => {
  const said: Record<string, unknown>[] = [];
  signInStepShown({} as Page, 'type', typedWords('Username'), (_t, f) => { said.push(f); });
  signInStepShown({} as Page, 'click', { e: '"Sign in" button' }, (_t, f) => { said.push(f); });
  expect(said.map((s) => `${s.a} ${s.e}`)).toEqual(['type Username', 'click "Sign in" button']);
  expect(said[0].v).toBeUndefined();
});

test('a password, a one-time code or a PIN shows as ***', () => {
  expect(typedWords('Password')).toEqual({ e: 'Password', v: '***' });
  expect(typedWords('كلمة السر')).toEqual({ e: 'كلمة السر', v: '***' });
  expect(typedWords('OTP')).toEqual({ e: 'OTP', v: '***' });
});
