/** the line a mailbox talk goes over: what is sent, what comes back, and its end */
export interface Wire {
  write(data: string): void;
  onData(feed: (chunk: Buffer) => void): void;
  end(): void;
}

/** one answer line of the mailbox, with the blocks of bytes it carried ({n} literals), in order */
interface Reply {
  line: string;
  literals: Buffer[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ANSWER_MS = 30_000;

/** "a\"b" - a word sent to the mailbox inside quotes */
function quote(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * The few mailbox (IMAP) commands reading an app's e-mail needs: sign in, look at a folder without changing it, find the
 * e-mails since a day (from a sender) and read one whole without marking it read.
 */
export class ImapClient {
  private buffer = Buffer.alloc(0);
  private current: Reply | undefined;
  private readonly replies: Reply[] = [];
  private wake: (() => void) | undefined;
  private tags = 0;

  constructor(private readonly wire: Wire, private readonly answerMs = ANSWER_MS) {
    wire.onData((chunk) => this.take(chunk));
  }

  /** the mailbox's hello; anything else stops in plain words */
  async greeting(): Promise<void> {
    const hello = await this.next();
    if (!/^\* (OK|PREAUTH)/i.test(hello.line)) throw new Error(`The mailbox did not greet as expected: ${hello.line}`);
  }

  async login(user: string, password: string): Promise<void> {
    await this.command(`LOGIN ${quote(user)} ${quote(password)}`, 'sign in');
  }

  /** opens a folder read-only (new e-mails show on each look) */
  async examine(folder: string): Promise<void> {
    await this.command(`EXAMINE ${quote(folder)}`, `open ${folder}`);
  }

  /** the e-mails the mailbox got since that day (its date only), from the sender when one is given; oldest first */
  async uidSearch(day: Date, sender: string): Promise<number[]> {
    const since = `${day.getUTCDate()}-${MONTHS[day.getUTCMonth()]}-${day.getUTCFullYear()}`;
    const replies = await this.command(`UID SEARCH SINCE ${since}${sender ? ` FROM ${quote(sender)}` : ''}`, 'search');
    return replies.filter((r) => /^\* SEARCH/i.test(r.line))
      .flatMap((r) => r.line.replace(/^\* SEARCH/i, '').trim().split(/\s+/).filter(Boolean).map(Number))
      .sort((a, b) => a - b);
  }

  /** one e-mail's raw bytes and when the mailbox got it - left unread */
  async uidFetch(uid: number): Promise<{ raw: Buffer; received?: Date }> {
    const replies = await this.command(`UID FETCH ${uid} (INTERNALDATE BODY.PEEK[])`, 'read an e-mail');
    const found = replies.find((r) => r.literals.length > 0);
    if (!found) throw new Error(`The mailbox gave no e-mail ${uid}`);
    const date = /INTERNALDATE "([^"]+)"/i.exec(found.line)?.[1];
    const received = date ? new Date(date.trim().replace(/^(\d{1,2})-(\w{3})-(\d{4})/, '$1 $2 $3')) : undefined;
    return { raw: found.literals[found.literals.length - 1], received: received && !Number.isNaN(received.getTime()) ? received : undefined };
  }

  async logout(): Promise<void> {
    await this.command('LOGOUT', 'sign out').catch(() => undefined);
    this.wire.end();
  }

  /** sends one command and gives back its untagged answers; a NO / BAD stops with the mailbox's own words */
  private async command(text: string, what: string): Promise<Reply[]> {
    const tag = `A${++this.tags}`;
    this.wire.write(`${tag} ${text}\r\n`);
    const untagged: Reply[] = [];
    for (;;) {
      const reply = await this.next();
      if (!reply.line.startsWith(`${tag} `)) {
        untagged.push(reply);
        continue;
      }
      const [, status, ...rest] = reply.line.split(' ');
      if (status.toUpperCase() !== 'OK') throw new Error(`The mailbox refused to ${what}: ${rest.join(' ')}`);
      return untagged;
    }
  }

  private async next(): Promise<Reply> {
    const until = Date.now() + this.answerMs;
    while (this.replies.length === 0) {
      const left = until - Date.now();
      if (left <= 0) throw new Error(`The mailbox did not answer within ${Math.round(this.answerMs / 1000)} s`);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, left);
        this.wake = () => { clearTimeout(timer); resolve(); };
      });
      this.wake = undefined;
    }
    return this.replies.shift()!;
  }

  private take(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.parse();
    if (this.replies.length > 0) this.wake?.();
  }

  /** whole lines into replies; a line ending in {n} carries the next n bytes and goes on after them */
  private parse(): void {
    for (;;) {
      const end = this.buffer.indexOf('\r\n');
      if (end < 0) return;
      const line = this.buffer.subarray(0, end).toString('utf8');
      const literal = /\{(\d+)\}$/.exec(line);
      const size = literal ? Number(literal[1]) : 0;
      if (literal && this.buffer.length < end + 2 + size) return; // its bytes are still coming
      const reply = this.current ?? { line: '', literals: [] };
      reply.line += line;
      if (literal) reply.literals.push(Buffer.from(this.buffer.subarray(end + 2, end + 2 + size)));
      this.buffer = this.buffer.subarray(end + 2 + size);
      this.current = literal ? reply : undefined;
      if (!literal) this.replies.push(reply);
    }
  }
}
