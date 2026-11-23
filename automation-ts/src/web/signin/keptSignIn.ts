import * as fs from 'node:fs';
import * as path from 'node:path';
import { asObject, asText, byName, Json, JsonObject, projectRoot, section } from '../../run/runDataFile';
import { testData } from '../../run/testData';
import { BrowserState, KeptCookie } from '../browserState';
import { PageSettings } from './pageSettingsCapture';
import { ClockState } from './signInClock';

/**
 * What Trova keeps about a login's sign-in (the run file's "signIn" and "signInRefresh") and what a run leaves for it -
 * the TS twin of utils.KeptSignIn: a new state, healed screen steps or the sign-in page's settings go to
 * <project>/target/trova-sessions, which the runner sends to Trova while the run goes on. Never prints a value.
 */

/** the login's saved screen sign-in steps ({url, steps, done}), or undefined */
export function screenRecipe(login: string): JsonObject | undefined {
  const r = asObject(asObject(byName(section('signIn'), login)).recipe);
  return Array.isArray(r.steps) && r.steps.length ? r : undefined;
}

/** the sign-in state Trova kept for the login (as the browser gets it, and as the clock reads it), or undefined */
export function keptState(login: string): { state: BrowserState; clock: ClockState } | undefined {
  if (keptEndedHere(login)) return undefined; // rejected in this run - never tried again
  const s =asObject(asObject(byName(section('signIn'), login)).session);
  if (!s.origin) return undefined;
  const texts = (v: Json | undefined): Record<string, string> => Object.fromEntries(Object.entries(asObject(v)).map(([k, x]) => [k, asText(x)]));
  const cookies = keptCookies(s.cookies);
  const state: BrowserState = { localStorage: texts(s.localStorage), sessionStorage: texts(s.sessionStorage),
    cookies: Object.fromEntries(cookies.map((c) => [c.name, c.value])), cookieList: cookies, // each cookie whole
    ...(Array.isArray(s.indexedDB) && s.indexedDB.length ? { indexedDB: s.indexedDB } : {}) }; // an older copy has none
  const signIn = (Array.isArray(s.signIn) ? s.signIn : []).map(asObject).map((t) => ({ place: asText(t.place), key: asText(t.key) }));
  return { state, clock: { ...state, cookies, signIn } };
}

/** kept cookies with every part Trova kept (domain, path, end time, flags) */
export function keptCookies(v: Json | undefined): KeptCookie[] {
  const same = (x: Json | undefined): KeptCookie['sameSite'] => {
    const t = asText(x).toLowerCase();
    return t === 'strict' ? 'Strict' : t === 'none' ? 'None' : t === 'lax' ? 'Lax' : undefined;
  };
  return (Array.isArray(v) ? v : []).map(asObject).filter((c) => c.name).map((c) => ({
    name: asText(c.name), value: asText(c.value),
    ...(c.domain ? { domain: asText(c.domain) } : {}), ...(c.path ? { path: asText(c.path) } : {}),
    ...(typeof c.expires === 'number' ? { expires: c.expires } : {}),
    ...(typeof c.httpOnly === 'boolean' ? { httpOnly: c.httpOnly } : {}), ...(typeof c.secure === 'boolean' ? { secure: c.secure } : {}),
    ...(same(c.sameSite) ? { sameSite: same(c.sameSite) } : {}) }));
}

/** the state the run's browser holds for a login, in the shape Trova keeps it - each cookie whole */
export function keptShape(state: BrowserState, url: string): JsonObject {
  const origin = new URL(url).origin;
  const whole = new Map((state.cookieList ?? []).map((c) => [c.name, c]));
  return { origin, at: url, localStorage: state.localStorage, sessionStorage: state.sessionStorage,
    cookies: Object.entries(state.cookies).map(([name, value]) => ({ path: '/', ...(whole.get(name) ?? {}), name, value }) as JsonObject),
    ...(state.indexedDB?.length ? { indexedDB: state.indexedDB } : {}) }; // the app's databases too
}

/** a sign-in that opened the app: the next runs start from it */
export function keepState(login: string, state: BrowserState, url: string): void {
  leave(login, 'state', keptShape(state, url), '');
}

/** screen steps with a box or button found again: the next runs use them */
export function keepRecipe(login: string, recipe: JsonObject): void {
  leave(login, 'recipe', recipe, '-steps');
}

/** the settings the sign-in page wrote (read once): the runner adds them to the login's recipe */
export function keepPageKeys(login: string, keys: PageSettings): void {
  leave(login, 'pageKeys', keys as JsonObject, '-page');
}

const codeWaits = new Map<string, JsonObject>();

/** when the sign-in asked for a code, the wait it learned - one file per login, merged, sent while the run goes on */
export function keepCodeWait(login: string, what: { askedAt?: number; learnedSeconds?: number }): void {
  const merged = { ...(codeWaits.get(login) ?? {}), ...what } as JsonObject;
  codeWaits.set(login, merged);
  leave(login, 'codeWait', merged, '-code');
}

/** the app rejected the kept sign-in - Trova forgets the one kept before this moment (a newer one stays) */
export function keptEnded(login: string, at: number = Date.now()): void {
  ended.add(login.trim().toLowerCase());
  leave(login, 'ended', { at }, '-ended');
}

/** this run already saw the kept sign-in rejected */
export function keptEndedHere(login: string): boolean {
  return ended.has(login.trim().toLowerCase());
}

const ended = new Set<string>();

/** the login's quick sign-in opened the app signed in - Trova counts a prefilled recipe as proven (once a run) */
export function recipeProven(login: string, at: number = Date.now()): void {
  if (provenHere.has(login.trim().toLowerCase())) return;
  provenHere.add(login.trim().toLowerCase());
  leave(login, 'proven', { at }, '-proven');
}

const provenHere = new Set<string>();

/** true when the login's API recipe was already read for page settings (it has some, or "pageKeysRead") */
export function pageSettingsKnown(recipe: JsonObject | undefined): boolean {
  if (!recipe) return true; // no recipe: nothing to add to
  const browser = Array.isArray(recipe.browser) ? recipe.browser : [];
  return recipe.pageKeysRead === true || browser.some((b) => asObject(b).ifMissing === true);
}

/** the page settings as the recipe's set-if-missing entries */
export function asIfMissing(keys: PageSettings): Json[] {
  return Object.entries(keys).flatMap(([place, kv]) => Object.entries(kv ?? {}).map(([key, value]) => ({ place, key, value, ifMissing: true })));
}

function leave(login: string, part: string, what: JsonObject, suffix: string): void {
  try {
    // TS runs go side by side - each run's own place (TROVA_SESSIONS_DIR), else the project's shared one
    const dir = process.env.TROVA_SESSIONS_DIR?.trim() || path.join(projectRoot(), 'target', 'trova-sessions');
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `${`${testData.env()}-${login}`.replace(/[^A-Za-z0-9._-]/g, '_')}${suffix}.json`);
    // written whole, then moved in: the runner sends it at once while the run goes on
    fs.writeFileSync(`${out}.part`, JSON.stringify({ login, environment: testData.env(), [part]: what }), 'utf8');
    fs.renameSync(`${out}.part`, out);
  } catch (e) {
    console.log(`The new sign-in could not be kept for the next runs: ${e instanceof Error ? e.name : 'not written'}`);
  }
}
