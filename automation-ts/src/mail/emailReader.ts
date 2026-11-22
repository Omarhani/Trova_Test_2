import { Email, emailOf, PASSWORD, USERNAME } from './email';
import { Mailbox, openImap, OpenMailbox } from './imapMailbox';
import { mailSettings, MailSettings } from './mailSettings';

/** what to wait for: the e-mail after the action (sentAfter, ms) whose words pass matches, within seconds */
export interface EmailWait {
  mailbox?: string;
  matches?: (text: string) => boolean;
  sentAfter: number;
  seconds: number;
}

/** the clock gap between this computer and the mail server; small, so the last run's e-mail is never picked */
const CLOCK_GAP_MS = 15_000;
const LOOK_EVERY_MS = 5_000;

/**
 * Reads the e-mails an app sends (sign-up, password reset, one-time code) and takes a value out of them:
 *
 *   const sentAfter = Date.now();
 *   ... the app sends the e-mail ...
 *   const email = await emailReader.waitFor({ matches: (t) => t.includes(userName), sentAfter, seconds: 120 });
 *   const password = email.value(PASSWORD);
 *
 * Only an e-mail the mailbox got after sentAfter counts, newest first; each e-mail is read once per wait.
 */
export class EmailReader {
  private found: Email | undefined;

  constructor(private readonly open: OpenMailbox = openImap,
              private readonly settings: (mailbox?: string) => MailSettings = mailSettings,
              private readonly pause: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
              private readonly now: () => number = Date.now) {}

  /** the e-mail the last wait found - the report shows it (showEmail) */
  last(): Email | undefined {
    return this.found;
  }

  async waitFor(wait: EmailWait): Promise<Email> {
    const settings = this.settings(wait.mailbox);
    this.found = undefined;
    const after = new Date(wait.sentAfter - CLOCK_GAP_MS);
    const until = this.now() + wait.seconds * 1000;
    const mailbox = await this.open(settings);
    try {
      const looked = new Set<number>();
      for (;;) {
        const email = await this.newest(mailbox, settings.sender, after, looked, wait.matches);
        if (email) return (this.found = email);
        if (this.now() >= until) break;
        await this.pause(LOOK_EVERY_MS);
      }
    } finally {
      await mailbox.close();
    }
    throw new Error(`No matching e-mail came to ${settings.user} within ${wait.seconds} s`);
  }

  /** the password a sign-up e-mail carries for that user name ("Username: x ... Password: y") */
  async waitForPassword(userName: string, sentAfter: number, seconds: number, mailbox?: string): Promise<string> {
    const forUser = (text: string): boolean => USERNAME.exec(text)?.[1]?.toLowerCase() === userName.toLowerCase() && PASSWORD.test(text);
    return (await this.waitFor({ mailbox, matches: forUser, sentAfter, seconds })).value(PASSWORD)!;
  }

  private async newest(mailbox: Mailbox, sender: string, after: Date, looked: Set<number>,
                       matches?: (text: string) => boolean): Promise<Email | undefined> {
    const uids = await mailbox.since(after, sender);
    for (const uid of [...uids].reverse()) {
      if (looked.has(uid)) continue;
      looked.add(uid);
      const mail = await mailbox.read(uid);
      if (!mail.received || mail.received < after) continue;
      const email = emailOf(mail.raw, mail.received);
      if (!matches || matches(email.text)) return email;
    }
    return undefined;
  }
}

/** the run's one e-mail reader */
export const emailReader = new EmailReader();
