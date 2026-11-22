import { BrowserContext, Page } from '@playwright/test';
import { BrowserState, KeptCookie } from '../browserState';
import { answerIn, waitAtMost } from './answerIn';
import { standInAddress } from './standIn';

/** how long the browser may take to open the app's address and to take the sign-in (each step) */
export interface PutLimits {
  openMs: number;
  answerMs: number;
}

const LIMITS: PutLimits = { openMs: 30_000, answerMs: 10_000 };

/** an empty browser state: the app shows its sign-in page */
export function emptyState(): BrowserState {
  return { localStorage: {}, sessionStorage: {}, cookies: {} };
}

/**
 * The login's whole browser state put into the run's browser: cookies, then local and session storage on the app's
 * after the app's sign-in page with Google's "I'm not
 * a robot" frame, the browser never answered the removal of the blank-page stand-in and the page set-up hung 5 min).
 */
export async function putState(page: Page, state: BrowserState, origin: string, limits: PutLimits = LIMITS): Promise<void> {
  const context = page.context();
  await context.clearCookies();
  await addEach(context, cookiesFor(state, origin));
  // an empty page on the app's origin - the app's own scripts never run before its sign-in is in place
  const standIn = standInAddress(origin);
  await page.route(standIn, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  await answerIn(page.goto(standIn, { waitUntil: 'domcontentloaded', timeout: limits.openMs }), limits.openMs + 1000,
    `The browser did not open the app's address within ${limits.openMs / 1000} s to put the sign-in in`);
  await answerIn(page.evaluate(({ local, session }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    for (const [k, v] of Object.entries(local)) window.localStorage.setItem(k, v);
    for (const [k, v] of Object.entries(session)) window.sessionStorage.setItem(k, v);
  }, { local: state.localStorage, session: state.sessionStorage }), limits.answerMs,
  `The browser did not take the sign-in within ${limits.answerMs / 1000} s`);
  // the stand-in serves an address the app never uses: a browser that does not answer its removal is not waited for
  await waitAtMost(page.unroute(standIn), limits.answerMs);
}

/**
 * bug 130: every cookie of the state - a kept one whole (its own domain, path, end time and flags; its value the state's
 * when the sign-in renewed it), any other one on the app's host as before
 */
export function cookiesFor(state: BrowserState, origin: string): Cookie[] {
  const host = new URL(origin).hostname;
  const secure = origin.startsWith('https');
  const whole = (state.cookieList ?? []).filter((c) => c.name).map((c) => ({
    name: c.name, value: state.cookies[c.name] ?? c.value, domain: c.domain || host, path: c.path || '/',
    expires: typeof c.expires === 'number' && c.expires > 0 ? c.expires : -1, httpOnly: !!c.httpOnly,
    secure: c.secure ?? secure, sameSite: c.sameSite ?? ('Lax' as const) }));
  const named = new Set(whole.map((c) => c.name));
  const rest = Object.entries(state.cookies).filter(([name]) => !named.has(name)).map(([name, value]) => ({
    name, value, domain: host, path: '/', expires: -1, httpOnly: false, secure, sameSite: 'Lax' as const }));
  return [...whole, ...rest];
}

type Cookie = Parameters<BrowserContext['addCookies']>[0][number];

/** review of PR 1044: each cookie on its own - one the browser refuses is left out by its name only, the others go in */
async function addEach(context: BrowserContext, cookies: Cookie[]): Promise<void> {
  for (const c of cookies) {
    await context.addCookies([c]).catch(() => console.log(`The browser did not take the kept cookie "${c.name}" - the others are in`));
  }
}

/**
 * what the app keeps in the browser now: its local and session storage, and EVERY cookie of the browser whole (every
 * domain and path, with its flags - review of PR 1044: a screen sign-in kept only name and value). Values never printed.
 */
export async function readState(page: Page): Promise<BrowserState> {
  const stores = await page.evaluate(() => ({ local: { ...window.localStorage }, session: { ...window.sessionStorage } }))
    .catch(() => ({ local: {}, session: {} }));
  const all = await page.context().cookies().catch(() => []);
  const cookieList: KeptCookie[] = all.map((c) => ({ name: c.name, value: c.value, domain: c.domain, path: c.path, expires: c.expires,
    httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite }));
  return { localStorage: stores.local as Record<string, string>, sessionStorage: stores.session as Record<string, string>,
    cookies: Object.fromEntries(all.map((c) => [c.name, c.value])), cookieList };
}
