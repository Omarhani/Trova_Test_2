import { expect, test } from '@playwright/test';
import { emailOf } from '../../src/mail/email';
import { EmailReportParts, showEmail } from '../../src/report/emailReport';
import { SecretValues } from '../../src/report/secretValues';

/** The e-mail a test waited for, in its report: its details, its values (secrets hidden) and the e-mail itself. */

const EMAIL = emailOf(Buffer.from([
  'From: no-reply@example.com', 'To: tester@example.com', 'Subject: Welcome',
  'Content-Type: text/html; charset=utf-8', '', '<p>Username: new.user</p><p>Password: Abc#123</p>',
].join('\r\n')));

function parts(): EmailReportParts & { steps: Record<string, unknown>[]; files: Record<string, string> } {
  const steps: Record<string, unknown>[] = [];
  const files: Record<string, string> = {};
  return {
    steps,
    files,
    secrets: new SecretValues(() => undefined),
    step: (fields) => steps.push(fields),
    attach: async (name, html) => { files[`attached:${name}`] = html; },
    keep: (name, html) => { files[`kept:${name}`] = html; },
  };
}

test('the user name shows and the password is hidden with its reference', async () => {
  const p = parts();
  await showEmail(EMAIL, 'Sign-up e-mail', undefined, p);
  expect(p.steps).toContainEqual(expect.objectContaining({ e: 'Sign-up e-mail · User name', v: 'new.user' }));
  const password = p.steps.find((s) => s.e === 'Sign-up e-mail · Password')!;
  expect(password.v).toBe('***');
  expect(password.secret).toBe(true);
});

test('the e-mail itself is attached and kept with the run, its password hidden', async () => {
  const p = parts();
  await showEmail(EMAIL, 'Sign-up e-mail', undefined, p);
  const attached = p.files['attached:Sign-up e-mail'];
  expect(attached).toContain('Welcome');
  expect(attached).toContain('new.user');
  expect(attached).not.toContain('Abc#123');
  expect(p.files['kept:Sign-up_e-mail-email.html']).toBe(attached);
});

test('the details line says who sent it and its subject', async () => {
  const p = parts();
  await showEmail(EMAIL, 'Email', undefined, p);
  expect(p.steps[0]).toMatchObject({ a: 'read', e: 'Email', v: 'Welcome - from no-reply@example.com' });
});

test('a code is shown hidden when the e-mail has no password', async () => {
  const p = parts();
  await showEmail(emailOf(Buffer.from('Content-Type: text/plain\r\n\r\nYour code 482913')), 'Email', undefined, p);
  const code = p.steps.find((s) => s.e === 'Email · Code')!;
  expect(code.v).toBe('***');
  expect(Object.values(p.files).join()).not.toContain('482913');
});

const RESET = emailOf(Buffer.from([
  'Subject: Reset', 'Content-Type: text/html; charset=utf-8', '',
  '<p>Reset here: https://app.example.com/reset?token=a1B2c3D4e5F6g7H8&amp;u=9</p>'
    + '<a href="https://app.example.com/reset?token=a1B2c3D4e5F6g7H8&amp;u=9">Reset</a> <a href="https://app.example.com/help">Help</a>',
].join('\r\n')));

test('a one-time link (reset / verify token) is hidden like a password, in the steps and the e-mail', async () => {
  const p = parts();
  await showEmail(RESET, 'Email', undefined, p);
  const link = p.steps.find((s) => s.e === 'Email · Link')!;
  expect(link.v).toBe('***');
  expect(link.secret).toBe(true);
  const kept = Object.values(p.files).join();
  expect(kept).not.toContain('a1B2c3D4e5F6g7H8');
  expect(kept).toContain('https://app.example.com/help');
});

test('a plain link with no token is shown', async () => {
  const p = parts();
  await showEmail(emailOf(Buffer.from('Content-Type: text/plain\r\n\r\nSee https://app.example.com/help')), 'Email', undefined, p);
  expect(p.steps.find((s) => s.e === 'Email · Link')?.v).toBe('https://app.example.com/help');
});

test('nothing is shown when no e-mail was found', async () => {
  const p = parts();
  await showEmail(undefined, 'Email', undefined, p);
  expect(p.steps).toHaveLength(0);
  expect(Object.keys(p.files)).toHaveLength(0);
});
