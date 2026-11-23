import { randomUUID } from 'node:crypto';
import { asObject, asText, byName, JsonObject, section } from './runDataFile';

/** The phone app of the environment (Test Data -> Environments -> Mobile app). */
export interface MobileApp {
  appPackage: string;
  appActivity: string;
  appFile: string;
}

/** The e-mail inbox of the environment: its server, the mailbox and the app's sender address. */
export interface EmailInbox {
  server: string;
  mailbox: string;
  sender: string;
}

/**
 * The run's environment data from Trova (Test Data -> Environments): addresses, API
 * headers, the phone app. Trova is the only source; no data file in the code.
 */
export class TestData {
  constructor(private readonly read: () => JsonObject = () => section('testData'),
              private readonly envName: () => string = () => process.env.TROVA_ENV?.trim() || 'Test') {}

  env(): string {
    return this.envName();
  }

  webUrl(): string {
    return this.address('WEB_URL');
  }

  apiUrl(): string {
    return this.address('API_BASE_URI');
  }

  /** the API the phone app calls; empty = the API */
  mobileApiUrl(): string {
    return this.address('MOBILE_API_BASE_URI') || this.apiUrl();
  }

  apiHeaders(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(asObject(asObject(this.read().API).HEADERS))) out[k] = asText(v);
    return out;
  }

  /** the fixed headers plus a fresh value for each per-call one (time-like names: the time in ms, else a new id) */
  apiHeadersForOneCall(): Record<string, string> {
    const out = this.apiHeaders();
    const names = asObject(this.read().API).PER_REQUEST_HEADERS;
    for (const name of Array.isArray(names) ? names.map(asText) : []) {
      out[name] = /time|date/i.test(name) ? String(Date.now()) : randomUUID();
    }
    return out;
  }

  isProd(): boolean {
    return this.read().PROD === true;
  }

  mobile(): MobileApp {
    const m = asObject(this.read().MOBILE);
    return { appPackage: asText(m.APP_PACKAGE), appActivity: asText(m.APP_ACTIVITY), appFile: asText(m.APK_PATH) };
  }

  /** the e-mail inbox the app's e-mails go to (Test Data -> Environments -> E-mail inbox); no server = Gmail */
  email(): EmailInbox {
    const e = asObject(this.read().EMAIL);
    return { server: asText(e.IMAP_HOST) || 'imap.gmail.com', mailbox: asText(e.MAILBOX), sender: asText(e.SENDER) };
  }

  private address(key: string): string {
    return asText(asObject(byName(asObject(this.read().ENVIRONMENTS), this.env()))[key]);
  }
}

export const testData = new TestData();
