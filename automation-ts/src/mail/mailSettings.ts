import { Credentials, credentials } from '../run/credentials';
import { TestData, testData } from '../run/testData';

/** where and as whom the app's e-mails are read; the password is never logged or reported */
export interface MailSettings {
  server: string;
  port: number;
  user: string;
  password: string;
  sender: string;
}

/** the login in Test Data that may hold the mailbox's app password */
export const INBOX_LOGIN = 'E-mail inbox';
const IMAPS_PORT = 993;

/**
 * The mailbox settings: server, mailbox and sender from the platform (Test Data -> Environments -> E-mail inbox); MAIL_USER or
 * the given mailbox overrides the mailbox. The app password comes from this computer (MAIL_APP_PASSWORD) or the login
 * "E-mail inbox" in Test Data -> Credentials - never from the code. Gmail needs an app password (2-step sign-in on).
 */
export function mailSettings(mailbox?: string, env: NodeJS.ProcessEnv = process.env, data: TestData = testData,
                             logins: Credentials = credentials): MailSettings {
  const inbox = data.email();
  const user = env.MAIL_USER?.trim() || mailbox?.trim() || inbox.mailbox;
  if (!user) throw new Error('No mailbox - add it in Trova > Test Data > Environments > E-mail inbox');
  const password = env.MAIL_APP_PASSWORD?.trim() || savedPassword(logins);
  if (!password) {
    throw new Error(`No app password for the mailbox ${user} - add a login "${INBOX_LOGIN}" with its App password in Trova > Test Data > Credentials`);
  }
  const [server, port] = inbox.server.split(':');
  return { server, port: Number(port) || IMAPS_PORT, user, password, sender: inbox.sender };
}

function savedPassword(logins: Credentials): string | undefined {
  try {
    return Credentials.field(logins.of(INBOX_LOGIN), 'App password|Password');
  } catch {
    return undefined; // no such login: the plain message above says where to add it
  }
}
