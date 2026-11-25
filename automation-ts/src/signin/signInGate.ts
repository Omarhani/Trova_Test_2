import { RunMode } from '../run/runMode';
import { BrowserLook, BrowserSignIn, endedWords, usingLine } from './browserSignIn';
import { SavedSignIn } from './savedSignIn';
import { SkipLogin } from './skipLogin';
import { kindOf, SetUpProblem, setUpSaid, SignInProblem, SlowAnswer } from '../report/failureKind';
import { codeTooSoon } from '../web/signin/codeWait';

/** the run's saved sign-ins and refusals, per login name */
export interface SignInBook {
  saved(login: string): SavedSignIn | undefined;
  save(login: string, saved: SavedSignIn): void;
  refused(login: string): string | undefined;
  refuse(login: string, why: string): void;
}

/** what the gate stands on - the browser side is given, so the gate knows no app and no page */
export interface GateDeps {
  mode: RunMode;
  book: SignInBook;
  /** the login the run's tab holds now ('' = none) */
  held: () => string;
  hold: (login: string) => void;
  /** hybrid: the run's API sign-in (fresh = a new one by the app's own calls) put in and proved: null, else why not */
  byApi: (login: string, fresh: boolean) => Promise<string | null>;
  /** full screen mode: the sign-in page with the login's saved steps, proved: null, else why not */
  byScreen: (login: string) => Promise<string | null>;
  /** the login's sign-in call is known and proven on this environment (none given = as before: by API) */
  apiProven?: (login: string) => boolean;
  /** the login has saved screen sign-in steps (none given = no screen fallback) */
  screenKnown?: (login: string) => boolean;
  /** the sign-in Trova kept (the writer's own, an earlier run's) put in whole: false = none kept */
  putKept?: (login: string) => Promise<boolean>;
  /** the app rejected the kept sign-in - Trova forgets it, so later runs do not try it again */
  dropKept?: (login: string) => void;
  /** the login's quick sign-in opened the app signed in - Trova counts its sign-in recipe as proven */
  quickProven?: (login: string) => void;
  /** the sign-in the tester saved from a real browser for this environment and login */
  browser: (login: string) => BrowserLook;
  /** that sign-in's whole state put into the run's tab (no sign-in call) */
  putBrowser: (saved: BrowserSignIn) => Promise<void>;
  /** the browser's whole state now (Playwright storageState + session storage) */
  capture: () => Promise<Omit<SavedSignIn, 'madeAt' | 'fresh'>>;
  put: (saved: SavedSignIn) => Promise<void>;
  /** the app opened and proved signed in: null, else why not ("the app refused the saved sign-in") */
  prove: () => Promise<string | null>;
  /** "in 4 min" when the saved sign-in runs out soon, else null */
  renewDue: (saved: SavedSignIn) => string | null;
  now: () => number;
  say: (line: string) => void;
  /** the app was seen signed in as login - the run's tick, never before that */
  proved: (login: string) => void;
}

/** the app said no to the sign-in - not a network break and not a slow page (those are tried again as before) */
function refusedByApp(e: unknown): boolean {
  const text = `${e instanceof Error ? e.name : 'Error'}: ${e instanceof Error ? e.message : String(e)}`;
  return !setUpSaid(text) && kindOf(text).kind !== 'slow';
}

/** the refusal with expected / seen in plain words ("seen: the sign-in page") */
function refusedWords(login: string, why: string): string {
  const seen = /went to its sign-in page/i.test(why) ? 'the sign-in page' : why;
  return `Expected: the app signed in as ${login} / Actual: ${seen}`; // one short Expected / Actual line
}

/**
 * ONE sign-in per run. The first case of a login signs in once - by the app's own
 * API calls in hybrid mode, on the sign-in page in full screen mode - and its state is saved; every later case opens
 * the app with that saved state and proves it is signed in, with no sign-in call. The app refuses it: that case fails
 * with the plain reason and every later case of the login is skipped (no second sign-in, never the sign-in page).
 * Hybrid only: a sign-in that runs out soon, or a sign-out in the middle of a case, gets ONE fresh API sign-in.
 * a sign-in the tester made himself in a real browser and saved (the app asks Google's robot check)
 * is used instead of any sign-in, in both modes; it ended or the app refused it = the plain reason, never a new one.
 */
export class SignInGate {
  /** the last sign-in was made on the sign-in screen (the run line says how it really signed in) */
  private onScreen = false;

  constructor(private readonly d: GateDeps) {}

  /** the case's app opened signed in as login; throws SkipLogin (skip) or the plain reason (fail) */
  async open(login: string): Promise<void> {
    this.skipIfRefused(login);
    const saved = this.d.book.saved(login);
    if (!saved) return this.signIn(login, 0);
    if (saved.browser && saved.browser.endsAt > 0 && this.d.now() >= saved.browser.endsAt) this.refuse(login, endedWords(login));
    const due = this.d.mode === 'hybrid' && !saved.browser ? this.d.renewDue(saved) : null;
    if (due) {
      this.d.say(`The sign-in of ${login} runs out ${due} - one fresh sign-in by the app's own calls`);
      return this.signIn(login, saved.fresh + 1);
    }
    if (this.d.held() !== login) await this.d.put(saved);
    const why = await this.d.prove();
    if (why) this.refuse(login, saved.browser ? endedWords(login) : refusedWords(login, why));
    this.d.hold(login);
    this.d.proved(login);
    this.d.say(`Opened signed in as ${login} with this run's saved sign-in (no sign-in calls)`);
  }

  /** the app signed out in the middle of a case: one fresh API sign-in (hybrid); full screen mode stops the case */
  async again(login: string): Promise<void> {
    this.skipIfRefused(login);
    if (this.d.book.saved(login)?.browser) this.refuse(login, endedWords(login));
    if (this.d.mode === 'ui') {
      throw new Error(`The app signed ${login} out in the middle of the case - full screen mode signs in once per run, so the case stops here`);
    }
    await this.signIn(login, (this.d.book.saved(login)?.fresh ?? 0) + 1);
  }

  private skipIfRefused(login: string): void {
    const no = this.d.book.refused(login);
    if (no) throw new SkipLogin(no);
  }

  /** the saved browser sign-in, else the mode's one sign-in - proved, then saved for the rest of the run */
  private async signIn(login: string, fresh: number): Promise<void> {
    if (await this.byBrowser(login)) return;
    if (!fresh && (await this.byKept(login))) return;
    let why: string | null;
    try {
      why = await this.byMode(login, fresh);
    } catch (e) {
      this.signInBroke(login, e);
    }
    // hybrid: the run's API sign-in is the saved one every case uses
    // no saved browser file was used here - it is Trova's own sign-in
    if (why) this.refuse(login, refusedWords(login, why));
    if (!this.onScreen) this.d.quickProven?.(login); // a prefilled recipe counts only once proven
    this.d.book.save(login, { ...(await this.d.capture()), madeAt: this.d.now(), fresh, ...(this.onScreen ? { onScreen: true } : {}) });
    this.d.hold(login);
    this.d.proved(login);
    this.d.say(fresh ? `Signed in again as ${login} - saved for the rest of the run`
      : `Signed in as ${login} once for this run (${this.onScreen ? 'on the sign-in page' : "by Trova's own sign-in calls"}) - every later case reuses it`);
  }

  /**
   * The kept sign-in: full screen mode, or no proven sign-in call, signs in on the sign-in screen; else by the
   * app's own calls, and a refusal there gets ONE sign-in on the screen before the login is refused (no step added when
   * the quick sign-in works). A network break or a slow page is no refusal - it goes on as before.
   */
  private async byMode(login: string, fresh: number): Promise<string | null> {
    const screen = this.d.screenKnown?.(login) ?? false;
    this.onScreen = this.d.mode === 'ui' || (screen && !!this.d.apiProven && !this.d.apiProven(login));
    if (this.onScreen) return this.d.byScreen(login);
    let why: string | null;
    try {
      why = await this.d.byApi(login, fresh > 0);
    } catch (e) {
      // still "wait for a new code" after the one wait = refused at once; the screen would ask a new code
      if (!screen || !refusedByApp(e) || codeTooSoon(e instanceof Error ? e.message : String(e))) throw e;
      why = e instanceof Error ? e.message : String(e);
    }
    if (!why || !screen) return why;
    this.d.say(`The quick sign-in of ${login} was refused (${why}) - signing in once on the sign-in screen instead`);
    this.onScreen = true;
    return this.d.byScreen(login);
  }

  /**
   * One sign-in per login and run: before the run's first sign-in, the sign-in Trova kept is put back
   * whole and proved - no new sign-in, no new one-time code. false = none kept, or it no longer opens the app.
   */
  private async byKept(login: string): Promise<boolean> {
    if (!this.d.putKept || !(await this.d.putKept(login))) return false;
    if (await this.d.prove()) { // it ended: one sign-in as before, and the dead one is forgotten
      this.d.dropKept?.(login);
      return false;
    }
    this.d.book.save(login, { ...(await this.d.capture()), madeAt: this.d.now(), fresh: 0 });
    this.d.hold(login);
    this.d.proved(login);
    this.d.say(`Opened signed in as ${login} with the sign-in saved earlier (no new sign-in) - every later case reuses it`);
    return true;
  }

  /** the sign-in the tester saved in a real browser, put in and proved instead of any sign-in call: false = none saved */
  private async byBrowser(login: string): Promise<boolean> {
    const look = this.d.browser(login);
    if (look.kind === 'none') return false;
    if (look.kind === 'ended') this.refuse(login, look.why);
    await this.d.putBrowser(look.signIn);
    if (await this.d.prove()) this.refuse(login, endedWords(login));
    this.d.book.save(login, { ...(await this.d.capture()), madeAt: this.d.now(), fresh: 0, browser: { endsAt: look.signIn.endsAt } });
    this.d.hold(login);
    this.d.proved(login);
    this.d.say(usingLine(login, look.signIn));
    return true;
  }

  /**
   * the sign-in threw: a network break = a set-up problem (tried once more), the app's page too slow = could not finish, in
   * plain words - neither refuses the login for the run; anything else is the app refusing it
   */
  private signInBroke(login: string, e: unknown): never {
    const said = e instanceof Error ? e.message : String(e);
    if (setUpSaid(`${e instanceof Error ? e.name : ''}: ${said}`)) throw new SetUpProblem(said);
    const seen = kindOf(`${e instanceof Error ? e.name : 'Error'}: ${said}`);
    if (seen.kind === 'slow') throw new SlowAnswer(seen.reason);
    this.refuse(login, said);
  }

  private refuse(login: string, why: string): never {
    this.d.book.refuse(login, why);
    throw new SignInProblem(why); // BLOCKED: the run's one sign-in ended or was refused - never a second one
  }
}
