import { expect, test } from '@playwright/test';
import { CODE, emailOf, LINK, PASSWORD, USERNAME } from '../../src/mail/email';

/** An app's e-mail (sign-up, reset, one-time code) read the way a person sees it: its words, its look and its values. */

const CRLF = '\r\n';

function mail(lines: string[]): Buffer {
  return Buffer.from(lines.join(CRLF), 'utf8');
}

const SIGN_UP = mail([
  'From: "Sample App" <no-reply@example.com>',
  'To: tester@example.com',
  'Subject: =?UTF-8?B?V2VsY29tZSDYp9mH2YTYpw==?=',
  'Date: Fri, 20 Nov 2026 10:00:00 +0000',
  'MIME-Version: 1.0',
  'Content-Type: multipart/related; boundary="rel"',
  '',
  '--rel',
  'Content-Type: multipart/alternative; boundary="alt"',
  '',
  '--alt',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'Username: new.user=0AP=',
  'assword: Abc#123',
  '--alt',
  'Content-Type: text/html; charset=utf-8',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('<p>Username: new.user</p><p>Password: Abc#123</p><img src="cid:logo@x">').toString('base64'),
  '--alt--',
  '--rel',
  'Content-Type: image/png',
  'Content-ID: <logo@x>',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('png-bytes').toString('base64'),
  '--rel--',
  '',
]);

test('a sign-up e-mail gives its user name and password from the text', () => {
  const email = emailOf(SIGN_UP);
  expect(email.value(USERNAME)).toBe('new.user');
  expect(email.value(PASSWORD)).toBe('Abc#123');
});

test('the headers are read in plain words, an encoded subject included', () => {
  const email = emailOf(SIGN_UP, new Date('2026-11-20T10:00:05Z'));
  expect(email.from).toBe('"Sample App" <no-reply@example.com>');
  expect(email.to).toBe('tester@example.com');
  expect(email.subject).toBe('Welcome اهلا');
  expect(email.sent?.toISOString()).toBe('2026-11-20T10:00:00.000Z');
  expect(email.received?.toISOString()).toBe('2026-11-20T10:00:05.000Z');
});

test('the e-mail keeps its look with its inline logo carried along', () => {
  const html = emailOf(SIGN_UP).html;
  expect(html).toContain('<p>Password: Abc#123</p>');
  expect(html).toContain(`data:image/png;base64,${Buffer.from('png-bytes').toString('base64')}`);
  expect(html).not.toContain('cid:logo@x');
});

test('a one-time code and a link are found in an HTML-only e-mail', () => {
  const email = emailOf(mail([
    'From: no-reply@example.com',
    'Subject: Your code',
    'Content-Type: text/html; charset=utf-8',
    '',
    '<style>p{color:red}</style><p>Your code is&nbsp;<b>482913</b></p><a href="https://app.example.com/reset?t=1">Reset</a> https://app.example.com/reset?t=1',
  ]));
  expect(email.value(CODE)).toBe('482913');
  expect(email.value(LINK)).toBe('https://app.example.com/reset?t=1');
  expect(email.text).not.toContain('color:red');
});

test('a plain text e-mail is shown as its own text, made safe for the report', () => {
  const email = emailOf(mail(['Subject: Hi', 'Content-Type: text/plain', '', 'Code: 1234 <ok>']));
  expect(email.html).toContain('Code: 1234 &lt;ok&gt;');
  expect(email.html.startsWith('<pre')).toBe(true);
});

test('an Arabic password line is read too', () => {
  const email = emailOf(mail(['Content-Type: text/plain; charset=utf-8', '', 'كلمة المرور: Zx9-77']));
  expect(email.value(PASSWORD)).toBe('Zx9-77');
});

test('the e-mail kept for the report runs nothing: scripts, event handlers and script links are taken out', () => {
  const html = emailOf(mail([
    'Content-Type: text/html; charset=utf-8', '',
    '<p onclick="steal()">Hi</p><script>alert(1)</script><a href="javascript:alert(2)">x</a>'
      + '<img src=x onerror=alert(3)><iframe src="https://evil.example.com"></iframe><object data="x"></object><a href="https://app.example.com">ok</a>',
  ])).html;
  expect(html).not.toMatch(/<script|onclick|onerror|javascript:|<iframe|<object/i);
  expect(html).toContain('<a href="https://app.example.com">ok</a>');
  expect(html).toContain('Hi');
});

test('a value the e-mail does not carry is undefined', () => {
  const email = emailOf(mail(['Content-Type: text/plain', '', 'Hello']));
  expect(email.value(CODE)).toBeUndefined();
  expect(email.value(PASSWORD)).toBeUndefined();
});
