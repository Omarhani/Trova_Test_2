import { send } from '../api/client/http';
import { reportedSend } from '../api/client/reportedSend';
import { credentials } from '../run/credentials';
import { asObject, byName, JsonObject, section } from '../run/runDataFile';
import { testData } from '../run/testData';
import { runRecipe, SignInResult } from '../api/client/recipe/recipeSignIn';
import { apiRefusal, appName } from '../web/signin/signInRefusal';
import { codeWindow } from '../web/signin/codeClock';
import { quickFailure, quickSignInWait } from './quickSignInWait';
import { runMode } from '../run/runMode';
import { apiFromBrowser } from './browserApiSignIn';
import { runSignIns } from './runSignIns';
import { runSignInBook } from './runSignInBook';
import { sharedSignIn } from './sharedSignIn';
import { screenSignInToken } from './screenSignInToken';
import { screenFirst, ScreenFirstDeps } from './screenFirst';
import { callsChanged } from './signInCallsChanged';
import { cleanUpRole, cleanUpSignIn } from './cleanUpSignIn';
import { signInLine } from '../records/signInLine';
import { SetUpProblem, SignInProblem } from '../report/failureKind';

/** the side a sign-in is made for: the web app's API, or the phone app's (its own recipe, on the mobile API) */
export type Side = 'web' | 'phone';

const done = new Map<string, Promise<SignInResult>>();
const refused = new Map<string, string>();
const quickWait = quickSignInWait(codeWindow);

/** the screen-first sign-in, set by the web side (screenFirstWeb); none set = the quick sign-in as before */
let screenFirstDeps: ScreenFirstDeps | undefined;

export function setScreenFirst(deps: ScreenFirstDeps | undefined): void {
  screenFirstDeps = deps;
}

const SCREENS_ONLY = "This suite runs in full screen mode: its sign-in and clean-up go through the screens, never the app's API"
  + ' (the suite parameter "mode" is "ui" - set it to "hybrid" for sign-in and clean-up by API)';

/**
 * The run's ONE API sign-in per login and side: Trova's shared one first, else the login's recipe once. A refusal is
 * never tried again in the run (repeated refusals can lock the account): the web side's refusal skips every later case
 * of the login (SkipLogin) - only the clean-up goes on, with the sign-in the run holds. Full screen mode never signs in by API. Never prints a value.
 */
export async function signIn(login: string, side: Side, again = false): Promise<SignInResult> {
  if (runMode() === 'ui') throw new Error(SCREENS_ONLY);
  const key = signInKey(login, side);
  const before = side === 'web' ? runSignInBook.refused(login) : undefined;
  if (before) return cleanUpSignIn(login, before, { role: cleanUpRole, held: () => heldSignIn(key, login, side), say: console.log });
  const apiNo = side === 'web' ? runSignInBook.apiRefused(login) : undefined; // refused in any worker - the screen sign-in's token
  if (apiNo) return screenSignInToken(apiNo, runSignInBook.saved(login), recipeOrNone(login));
  if (side === 'web' && screenFirstDeps) { // no proven quick sign-in = once on the screen, its token for the app's calls
    const viaScreen = await screenFirst(login, screenFirstDeps);
    if (viaScreen) return viaScreen;
  }
  const no = refused.get(key);
  if (no) throw new SignInProblem(no);
  let pending = again ? undefined : done.get(key);
  if (!pending) {
    pending = fresh(key, login, side, again);
    done.set(key, pending);
  }
  try {
    return await pending;
  } catch (e) {
    const said = e instanceof Error ? e.message : String(e);
    if (quickFailure(e) === 'break') {
      done.delete(key); // a network break, not a refusal: the second try signs in again
      throw new SetUpProblem(said);
    }
    // the app's code window was already waited out once inside the sign-in - refused for the run
    const why = callsChanged(said) ?? said;
    refused.set(key, why);
    if (side === 'web') runSignInBook.refuse(login, why); // every later case of this login is skipped with this reason
    throw new SignInProblem(why);
  }
}

/** the run's sign-in of the login was made on the sign-in screen (else by quick calls or a kept one) */
export function signedInOnScreen(login: string): boolean {
  return runSignInBook.saved(login)?.onScreen === true;
}

/** one sign-in per side and login, any letter case */
export function signInKey(login: string, side: Side): string {
  return `${side}|${login.trim().toLowerCase()}`;
}

/** an earlier block of this run made the login's sign-in, and it does not run out soon */
export function runHas(login: string, side: Side): boolean {
  return runSignIns.get(signInKey(login, side)) !== undefined;
}

/** the values the sign-in kept (USER_ID, ACCOUNT_ID ...) - a known body takes its ids by field name */
export function keptValues(result: SignInResult): Record<string, string> {
  return { ...result.browser.cookies, ...result.browser.sessionStorage, ...result.browser.localStorage };
}

/** the login's recipe for the side; the phone falls back to the web recipe tried on the mobile API */
export function recipeFor(login: string, side: Side): JsonObject {
  const phone = side === 'phone' ? asObject(byName(section('signInApiPhone'), login)) : {};
  const recipe = phone.calls ? phone : asObject(byName(section('signInApi'), login));
  if (!recipe.calls) throw new Error(`Trova has no sign-in recipe for "${login}" on ${testData.env()}`);
  return recipe;
}

/**
 * The sign-in the tester saved in a real browser (web side; it ended = the plain reason, never a new one), the run's
 * sign-in an earlier block made (one sign-in per run), Trova's shared one, else the login's recipe - kept for
 * the run's later blocks. again: the sign-in ran out in the middle of the run - a new one by the recipe, never one
 * that ran out.
 */
async function fresh(key: string, login: string, side: Side, again: boolean): Promise<SignInResult> {
  const saved = side === 'web' ? apiFromBrowser(login, again) : undefined;
  if (saved) return saved;
  const held = again ? undefined : heldSignIn(key, login, side);
  if (held) return held;
  const base = side === 'phone' ? testData.mobileApiUrl() : testData.apiUrl();
  const recipe = recipeFor(login, side);
  const result = await quickWait(login, recipe, () => runRecipe(recipe, credentials.of(login), base, reportedSend(send), () => testData.apiHeadersForOneCall())
    .catch((e: unknown) => plainly(() => { throw e; }))); // the app's code window waited out once
  if (!result.token) throw new Error(`The sign-in as ${login} gave no token`);
  runSignIns.keep(key, result);
  // Network marks these calls "API" (the test's own client); the page's own calls (its GetAccountIdByCode on opening ...) are "Web"
  console.log(`${signInLine(login, 'api')} - Trova's own sign-in calls, the run's one sign-in (no sign-in page)`);
  return result;
}

/** the login's web recipe for its token key; none = undefined */
function recipeOrNone(login: string): JsonObject | undefined {
  try {
    return recipeFor(login, 'web');
  } catch {
    return undefined;
  }
}

/** the run's sign-in an earlier block made, else Trova's shared one - no sign-in call; undefined = neither */
function heldSignIn(key: string, login: string, side: Side): SignInResult | undefined {
  const earlier = runSignIns.get(key);
  if (earlier) {
    console.log(signInLine(login, 'api', "this run's sign-in reused (no sign-in calls)"));
    return earlier;
  }
  const shared = plainly(() => sharedSignIn(login, side === 'phone'));
  if (shared) console.log(signInLine(login, 'api', 'the sign-in Trova shares (no new sign-in)'));
  return shared;
}

/** the app's refusal in plain words with its own reason; any other error as it is */
function plainly<T>(run: () => T): T {
  try {
    return run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(apiRefusal(appName(testData.webUrl()), msg, () => Object.keys(testData.apiHeaders()).length > 0));
  }
}
