import { expect, test } from '@playwright/test';
import { EmailReader } from '../../src/mail/emailReader';
import { Mailbox, RawMail } from '../../src/mail/imapMailbox';
import { mailSettings, MailSettings } from '../../src/mail/mailSettings';
import { TestData } from '../../src/run/testData';
import { Credentials } from '../../src/run/credentials';

/** Waiting for the app's e-mail: only one that came after the action, newest first, matching what the test wants. */

const SETTINGS: MailSettings = { server: 'imap.example.com', port: 993, user: 'tester@example.com', password: 'app-pass', sender: 'no-reply@example.com' };
const AFTER = Date.parse('2026-11-20T10:00:00Z');

function raw(text: string): Buffer {
  return Buffer.from(`Content-Type: text/plain; charset=utf-8\r\n\r\n${text}`, 'utf8');
}

/** a mailbox whose e-mails arrive on the given poll (0 = there from the start) */
function mailbox(mails: Array<RawMail & { uid: number; poll?: number }>, log: string[] = []): () => Promise<Mailbox> {
  let polls = -1;
  return async () => ({
    since: async () => { polls++; return mails.filter((m) => (m.poll ?? 0) <= polls).map((m) => m.uid); },
    read: async (uid: number) => { log.push(`read ${uid}`); return mails.find((m) => m.uid === uid)!; },
    close: async () => { log.push('closed'); },
  });
}

function reader(open: () => Promise<Mailbox>, clock = { now: AFTER }): EmailReader {
  return new EmailReader(open, () => SETTINGS, async (ms) => { clock.now += ms; }, () => clock.now);
}

test('the newest matching e-mail after the action is the one given back', async () => {
  const open = mailbox([
    { uid: 1, raw: raw('Username: other Password: x1'), received: new Date(AFTER + 1000) },
    { uid: 2, raw: raw('Username: new.user Password: Abc#123'), received: new Date(AFTER + 2000) },
  ]);
  const email = await reader(open).waitFor({ matches: (t) => t.includes('new.user'), sentAfter: AFTER, seconds: 30 });
  expect(email.text).toContain('Abc#123');
});

test('an e-mail from before the action (the last run\'s) is never picked', async () => {
  const open = mailbox([{ uid: 1, raw: raw('Code 111111'), received: new Date(AFTER - 60_000) }]);
  const failed = await reader(open).waitFor({ sentAfter: AFTER, seconds: 10 }).then(() => '', (e: Error) => e.message);
  expect(failed).toBe('No matching e-mail came to tester@example.com within 10 s');
});

test('an e-mail that comes later is found on a later look, each e-mail read once', async () => {
  const log: string[] = [];
  const open = mailbox([
    { uid: 1, raw: raw('Hello'), received: new Date(AFTER + 500) },
    { uid: 2, raw: raw('Code 482913'), received: new Date(AFTER + 9000), poll: 2 },
  ], log);
  const email = await reader(open).waitFor({ matches: (t) => /\d{6}/.test(t), sentAfter: AFTER, seconds: 60 });
  expect(email.text).toContain('482913');
  expect(log.filter((l) => l === 'read 1')).toHaveLength(1);
  expect(log[log.length - 1]).toBe('closed');
});

test('the password for a user name comes from that user\'s e-mail only', async () => {
  const open = mailbox([
    { uid: 1, raw: raw('Username: new.user\nPassword: Abc#123'), received: new Date(AFTER + 1000) },
    { uid: 2, raw: raw('Username: someone.else\nPassword: Zz9'), received: new Date(AFTER + 2000) },
  ]);
  expect(await reader(open).waitForPassword('NEW.USER', AFTER, 30)).toBe('Abc#123');
});

test('the e-mail found last is kept for the report; none before a wait', async () => {
  const r = reader(mailbox([{ uid: 3, raw: raw('Code 1234'), received: new Date(AFTER + 1) }]));
  expect(r.last()).toBeUndefined();
  await r.waitFor({ sentAfter: AFTER, seconds: 5 });
  expect(r.last()?.text).toContain('1234');
});

const DATA = new TestData(() => ({ EMAIL: { IMAP_HOST: 'imap.example.com:1993', MAILBOX: 'inbox@example.com', SENDER: 'no-reply@example.com' } }));
const NO_LOGINS = new Credentials(() => ({}));

test('the mailbox settings come from Test Data and the app password from the computer', () => {
  const s = mailSettings(undefined, { MAIL_APP_PASSWORD: 'p1' }, DATA, NO_LOGINS);
  expect(s).toEqual({ server: 'imap.example.com', port: 1993, user: 'inbox@example.com', password: 'p1', sender: 'no-reply@example.com' });
});

test('the app password may be a login named E-mail inbox in Test Data', () => {
  const logins = new Credentials(() => ({ 'E-mail inbox': { 'App password': 'p2' } }));
  expect(mailSettings('other@example.com', {}, DATA, logins).password).toBe('p2');
  expect(mailSettings('other@example.com', {}, DATA, logins).user).toBe('other@example.com');
});

test('with no inbox server Gmail is used', () => {
  const s = mailSettings('a@example.com', { MAIL_APP_PASSWORD: 'p' }, new TestData(() => ({})), NO_LOGINS);
  expect([s.server, s.port]).toEqual(['imap.gmail.com', 993]);
});

test('no mailbox or no app password stops in plain words', () => {
  const none = new TestData(() => ({}));
  expect(() => mailSettings(undefined, { MAIL_APP_PASSWORD: 'p' }, none, NO_LOGINS)).toThrow('No mailbox - add it in Trova > Test Data > Environments > E-mail inbox');
  expect(() => mailSettings('a@example.com', {}, none, NO_LOGINS)).toThrow('No app password for the mailbox');
});
