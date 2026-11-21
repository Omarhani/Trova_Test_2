import { expect, test } from '@playwright/test';
import { ImapClient, Wire } from '../../src/mail/imapClient';

/** The mailbox talk an app's e-mail is read over (IMAP): sign in, look at the inbox, find and read one e-mail. */

class FakeServer implements Wire {
  readonly sent: string[] = [];
  private feed: (chunk: Buffer) => void = () => undefined;

  constructor(private readonly answer: (tag: string, command: string) => string[]) {}

  write(data: string): void {
    this.sent.push(data);
    const [tag, ...rest] = data.trim().split(' ');
    const lines = this.answer(tag, rest.join(' '));
    // the answer comes in two pieces, as a network gives it
    const all = Buffer.from(lines.join('\r\n') + '\r\n', 'utf8');
    setTimeout(() => { this.feed(all.subarray(0, 7)); this.feed(all.subarray(7)); }, 1);
  }

  onData(feed: (chunk: Buffer) => void): void {
    this.feed = feed;
  }

  greet(): void {
    this.feed(Buffer.from('* OK ready\r\n'));
  }

  end(): void {
    // nothing to close
  }
}

const BODY = 'Subject: Code\r\n\r\nYour code 123456';

function server(): FakeServer {
  return new FakeServer((tag, command) => {
    if (command.startsWith('LOGIN')) return command.includes('"wrong"') ? [`${tag} NO [AUTHENTICATIONFAILED] Invalid credentials`] : [`${tag} OK signed in`];
    if (command.startsWith('EXAMINE')) return ['* 3 EXISTS', `${tag} OK [READ-ONLY] done`];
    if (command.startsWith('UID SEARCH')) return ['* SEARCH 7 9', `${tag} OK done`];
    if (command.startsWith('UID FETCH')) {
      return [`* 2 FETCH (UID 9 INTERNALDATE "20-Nov-2026 10:00:05 +0000" BODY[] {${Buffer.byteLength(BODY)}}`, `${BODY})`, `${tag} OK done`];
    }
    return [`${tag} OK`];
  });
}

async function opened(wire: FakeServer): Promise<ImapClient> {
  const client = new ImapClient(wire);
  const ready = client.greeting();
  wire.greet();
  await ready;
  return client;
}

test('signs in, looks at the inbox and finds the e-mails since a day from a sender', async () => {
  const wire = server();
  const client = await opened(wire);
  await client.login('tester@example.com', 'app-pass');
  await client.examine('INBOX');
  expect(await client.uidSearch(new Date('2026-11-20T09:00:00Z'), 'no-reply@example.com')).toEqual([7, 9]);
  expect(wire.sent[2]).toMatch(/^A3 UID SEARCH SINCE \d{1,2}-Nov-2026 FROM "no-reply@example.com"\r\n$/);
});

test('reads one e-mail whole, with the time the mailbox got it', async () => {
  const client = await opened(server());
  const mail = await client.uidFetch(9);
  expect(mail.raw.toString('utf8')).toBe(BODY);
  expect(mail.received?.toISOString()).toBe('2026-11-20T10:00:05.000Z');
});

test('a refused sign-in fails in plain words without the password', async () => {
  const client = await opened(server());
  const failed = await client.login('tester@example.com', 'wrong').then(() => '', (e: Error) => e.message);
  expect(failed).toContain('Invalid credentials');
  expect(failed).not.toContain('wrong');
});

test('a search with no sender looks only at the day', async () => {
  const wire = server();
  const client = await opened(wire);
  await client.uidSearch(new Date('2026-11-20T09:00:00Z'), '');
  expect(wire.sent[0]).not.toContain('FROM');
});

test('quotes and backslashes in a sign-in are sent safely', async () => {
  const wire = server();
  const client = await opened(wire);
  await client.login('a"b', 'c\\d');
  expect(wire.sent[0]).toBe('A1 LOGIN "a\\"b" "c\\\\d"\r\n');
});
