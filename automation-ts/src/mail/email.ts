import { lookOf, textOf } from './emailContent';
import { parseMime } from './mimeParts';

/** "Username: x" / "User name: x" / "اسم المستخدم: x" - the value is the first group */
export const USERNAME = /(?:Username|User name|اسم المستخدم)\s*:\s*(\S+)/;
/** "Password: x" / "كلمة المرور: x" */
export const PASSWORD = /(?:Password|كلمة المرور)\s*:\s*(\S+)/;
/** the first 4-8 digit number: a one-time or verification code */
export const CODE = /\b(\d{4,8})\b/;
/** the first http(s) link */
export const LINK = /(https?:\/\/[^\s"'<>]+)/;

/**
 * An e-mail an app sent (sign-up, password reset, one-time code), as it was read from the mailbox: who sent it, to whom,
 * its subject and times, its words (text) and how it looks (html) - kept whole so the report can show it after the
 * mailbox is closed.
 */
export class Email {
  constructor(readonly from: string, readonly to: string, readonly subject: string, readonly sent: Date | undefined,
              readonly received: Date | undefined, readonly html: string, readonly text: string) {}

  /** the first group of the pattern's first match in the words (the whole match when it has no group); undefined when none */
  value(pattern: RegExp): string | undefined {
    const m = pattern.exec(this.text);
    if (!m) return undefined;
    return m.length > 1 ? m[1] : m[0];
  }
}

/** an e-mail from its raw bytes; received = when the mailbox got it */
export function emailOf(raw: Buffer, received?: Date): Email {
  const root = parseMime(raw);
  const text = textOf(root);
  const sent = root.headers.date ? new Date(root.headers.date) : undefined;
  return new Email(root.headers.from ?? '', root.headers.to ?? '', root.headers.subject ?? '',
    sent && !Number.isNaN(sent.getTime()) ? sent : undefined, received, lookOf(root, text), text);
}
