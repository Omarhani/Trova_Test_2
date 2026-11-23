import { codeTooSoon, hardNo, namedWaitMs } from './codeWait';

/** what the wait stands on: the clock, the plain line, the last code request, the login's wait and where a learned one goes */
export interface CodeWindowDeps {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  say: (line: string) => void;
  /** when a sign-in of the login last asked the app for a code (epoch ms, any run), undefined = not known */
  lastAsked: (login: string) => number | undefined;
  asked: (login: string, at: number) => void;
  /** the login's "Wait between sign-in codes" in ms; undefined = empty (no wait) */
  windowMs: (login: string) => number | undefined;
  /** an empty wait filled with what the app's answer taught (Test Data → Credentials) */
  learn: (login: string, ms: number) => void;
}

/** the app said "wait" with no time and the login has no wait set: the common 2 minutes */
const FALLBACK_MS = 2 * 60_000;
/** a little past the window, so the app's own clock has surely let it go */
const MARGIN_MS = 5_000;
/** a time the app names over this is no code window - the sign-in fails with the app's words */
const NAMED_CAP_MS = 15 * 60_000;

/** exact: "2 minutes" / "90 seconds"; rough (a wait under way): whole minutes from a minute up - "2 minutes" */
export function plainTime(ms: number, rough = false): string {
  const s = Math.ceil(ms / 1000);
  if (s < 60 || (!rough && s % 60 !== 0)) return `${s} seconds`;
  const m = Math.round(s / 60);
  return m === 1 ? '1 minute' : `${m} minutes`;
}

/**
 * For ANY app: an app that sends a one-time code allows a new one only after a
 * while. A new sign-in waits only what is left of the login's wait since the last code request (any run); the app
 * still inside its window (it says so in any language, or its code step just waits) is waited out ONCE - the time the
 * app names, else the login's wait - and the sign-in made once more. An empty wait learns what the app said. A wrong
 * code or a locked account fails at once. Refused again = the app's own words. Never a loop.
 */
export class CodeWindow {
  constructor(private readonly d: CodeWindowDeps) {}

  /**
   * tooSoon: the page's words show the app still inside its window. asksCode: the sign-in really asks a
   * code - only then is it waited for and recorded as a code request (a kept sign-in, user name + password are not).
   */
  async run<T>(login: string, signIn: () => Promise<T>, tooSoon: (e: unknown) => Promise<boolean>, asksCode = true): Promise<T> {
    const set = this.d.windowMs(login);
    if (set && asksCode) await this.waitOut(this.d.lastAsked(login), set);
    const first = this.d.now();
    if (asksCode) this.d.asked(login, first);
    try {
      return await signIn();
    } catch (e) {
      const said = e instanceof Error ? e.message : String(e);
      if (hardNo(said)) throw e;
      const soon = codeTooSoon(said);
      if (!soon && !(await tooSoon(e).catch(() => false))) throw e;
      await this.waitOut(first, this.windowAfter(login, said, soon, set, e));
      this.d.asked(login, this.d.now());
      return signIn();
    }
  }

  /** the time the app named (over 15 minutes = fails with the app's words), else the login's wait, else 2 minutes */
  private windowAfter(login: string, said: string, soon: boolean, set: number | undefined, e: unknown): number {
    const named = namedWaitMs(said);
    if (named !== undefined && named > NAMED_CAP_MS) throw e; // never hours - the app's own words
    const window = named ?? set ?? FALLBACK_MS;
    if (soon && set === undefined) {
      this.d.learn(login, window);
      this.d.say(`The app asks to wait between sign-in codes - Trova saved "Wait between sign-in codes" = ${plainTime(window)} for ${login}`);
    }
    return window;
  }

  /** waits the rest of the window since at (nothing when it has passed) */
  private async waitOut(at: number | undefined, window: number): Promise<void> {
    if (at === undefined) return;
    // a request "in the future" (a clock that is off) never waits longer than the window
    const left = Math.min(at + window + MARGIN_MS - this.d.now(), window + MARGIN_MS);
    if (left <= MARGIN_MS) return;
    this.d.say(`Waiting ${plainTime(Math.min(left, window), true)} - the app allows a new sign-in code only then`);
    await this.d.sleep(left);
  }
}
