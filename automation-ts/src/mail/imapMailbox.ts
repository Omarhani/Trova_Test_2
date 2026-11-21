import * as tls from 'node:tls';
import { ImapClient, Wire } from './imapClient';
import { MailSettings } from './mailSettings';

/** one e-mail's raw bytes and when the mailbox got it */
export interface RawMail {
  raw: Buffer;
  received?: Date;
}

/** an open mailbox: the e-mails since a day (oldest first), one read whole, then closed */
export interface Mailbox {
  since(day: Date, sender: string): Promise<number[]>;
  read(uid: number): Promise<RawMail>;
  close(): Promise<void>;
}

export type OpenMailbox = (settings: MailSettings) => Promise<Mailbox>;

/** the secure line to the mailbox's server */
function tlsWire(settings: MailSettings): Wire {
  const socket = tls.connect({ host: settings.server, port: settings.port, servername: settings.server });
  return {
    write: (data) => { socket.write(data); },
    onData: (feed) => { socket.on('data', feed); },
    end: () => { socket.end(); },
  };
}

/** the inbox of the settings' mailbox, signed in over a secure line; each look opens the inbox again so new e-mail shows */
export const openImap: OpenMailbox = async (settings) => {
  const client = new ImapClient(tlsWire(settings));
  await client.greeting();
  await client.login(settings.user, settings.password).catch((e: Error) => {
    void client.logout();
    throw new Error(`Could not read the mailbox ${settings.user}: ${e.message}`);
  });
  return {
    since: async (day, sender) => {
      await client.examine('INBOX');
      // a mailbox's day is in its own time zone: one day earlier, the exact time is checked on each e-mail
      return client.uidSearch(new Date(day.getTime() - 24 * 3600_000), sender);
    },
    read: (uid) => client.uidFetch(uid),
    close: () => client.logout(),
  };
};
