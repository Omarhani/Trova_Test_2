import { Page, Request, Response } from '@playwright/test';
import { emit } from '../../report/liveEvents';

/**
 * After "Log in programmatically" an app can open signed in but without its look (its side menu unstyled), and a run
 * would pass silently. A quick look at the page right after the sign-in, for any app: no style source at all (style
 * files, inline styles, adopted sheets, web components' own styles all count), a style file that did not load, the
 * app's colour settings not in effect. Plain words only; it never blocks a case, and its warning reaches the run screen.
 * The rule list and wording are the same in the suites and Trova's AI runs.
 */

/** the one wording of the warning, in the suites and Trova's AI alike */
export const LOOK_WARNING = 'Warning: the page opened signed in but looks unstyled - ';
const LOOK_WHY = '. A setting the app keeps in the browser (its theme or language) may be missing from the sign-in Trova put back, or a style file is not reachable.';

/** a load the browser itself stopped (the page opened again, or the same file was asked once more) - not a failure */
const STOPPED = /ERR_ABORTED|cancel|NS_BINDING_ABORTED/i;

/**
 * the style files of the app that failed to load from now on (their file names): refused by the server (4xx / 5xx) or
 * not reached. Fonts are not style files; a load the browser stopped itself is not a failure.
 */
export function watchStyleLoads(page: Page): { failed: () => string[]; stop: () => void } {
  const failed = new Set<string>();
  const kind = (r: Request): boolean => r.resourceType() === 'stylesheet';
  const name = (url: string): string => url.replace(/[?#].*$/, '').split('/').filter(Boolean).pop() || url;
  const onFail = (r: Request): void => { if (kind(r) && !STOPPED.test(r.failure()?.errorText ?? '')) failed.add(name(r.url())); };
  const onAnswer = (a: Response): void => { if (kind(a.request()) && a.status() >= 400) failed.add(name(a.url())); };
  page.on('requestfailed', onFail);
  page.on('response', onAnswer);
  return {
    failed: () => [...failed],
    stop: () => { page.off('requestfailed', onFail); page.off('response', onAnswer); },
  };
}

/** page code: what looks unstyled now (empty = looks right) - the shared rule list */
export const LOOK_RULES = `(async () => {
  const look = async () => {
  const seen = [];
  const waiting = [...document.querySelectorAll('link[rel~=stylesheet][href]')].filter((l) => !l.sheet);
  const broke = new Set();
  await Promise.all(waiting.map((l) => new Promise((done) => { l.addEventListener('load', done); l.addEventListener('error', () => { broke.add(l); done(); }); setTimeout(done, 3000); })));
  const roots = [];
  const walk = (root) => { for (const el of root.querySelectorAll('*')) if (el.shadowRoot) { roots.push(el.shadowRoot); walk(el.shadowRoot); } };
  walk(document);
  const ruled = (s) => { try { return s.cssRules.length > 0; } catch (e) { return true; } };
  const sheets = [...document.styleSheets, ...(document.adoptedStyleSheets || [])].filter(ruled);
  const inner = roots.flatMap((r) => [...r.styleSheets, ...(r.adoptedStyleSheets || [])]).filter(ruled);
  const inline = !!document.querySelector('[style]') || roots.some((r) => !!r.querySelector('[style]'));
  if (!sheets.length && !inner.length && !inline) seen.push('no styles are applied');
  const fileOf = (u) => u.replace(/[?#].*$/, '').split('/').filter(Boolean).pop() || u;
  const statusOf = (u) => { const e = performance.getEntriesByName(u).pop(); return e && e.responseStatus ? e.responseStatus : 0; };
  const ended = (u) => performance.getEntriesByName(u).length > 0;
  const lost = [...document.querySelectorAll('link[rel~=stylesheet][href]')].filter((l) => broke.has(l) || statusOf(l.href) >= 400 || (!l.sheet && ended(l.href))).map((l) => fileOf(l.href));
  if (lost.length) seen.push('a style file did not load (' + lost.slice(0, 5).join(', ') + ')');
  const styleRules = [];
  const collect = (list, scope, now) => {
    for (const r of [...(list || [])].slice(0, 4000)) {
      if (r.style && r.selectorText) styleRules.push({ r, scope, now });
      else if (r.media && r.cssRules) collect(r.cssRules, scope, now && window.matchMedia(r.media.mediaText || 'all').matches);
      else if (r.cssRules) collect(r.cssRules, scope, now);
    }
  };
  const rulesOf = (s) => { try { return s.cssRules; } catch (e) { return []; } };
  for (const s of sheets) collect(rulesOf(s), document, true);
  for (const root of roots) for (const s of [...root.styleSheets, ...(root.adoptedStyleSheets || [])]) collect(rulesOf(s), root, true);
  const first = (x) => { if (!x.now) return null; try { return x.scope.querySelector(x.r.selectorText); } catch (e) { return null; } };
  const usedIn = (text) => text.split('var(').slice(1).map((t) => t.slice(0, t.indexOf(')')).trim()).filter((n) => n.startsWith('--') && !n.includes(','));
  const declared = new Map();
  for (const x of styleRules) for (const p of [...x.r.style]) if (p.startsWith('--')) (declared.get(p) || declared.set(p, []).get(p)).push(x);
  const direct = (text) => {
    const parts = [];
    for (const p of text.split(';')) if (!parts.length || /^ *-?[-a-zA-Z0-9_]+ *:/.test(p)) parts.push(p); else parts[parts.length - 1] += ';' + p;
    return parts.filter((d) => !d.trim().startsWith('--')).join(';');
  };
  const shown = new Map();
  const shownOf = (n) => { if (!shown.has(n)) shown.set(n, declared.get(n).filter((d) => !!first(d))); return shown.get(n); };
  const lostVia = (el, n, depth) => {
    if (!declared.has(n) || getComputedStyle(el).getPropertyValue(n).trim()) return null;
    const on = shownOf(n);
    if (!on.length) return n;
    if (depth > 3) return null;
    for (const d of on) for (const m of usedIn(d.r.style.getPropertyValue(n))) { const gone = lostVia(el, m, depth + 1); if (gone) return gone; }
    return null;
  };
  const lostSettings = new Set();
  for (const x of styleRules) {
    const el = first(x);
    if (!el) continue;
    for (const n of usedIn(direct(x.r.style.cssText))) { const gone = lostVia(el, n, 0); if (gone) lostSettings.add(gone); }
  }
  if (lostSettings.size) seen.push("the app's colour settings are empty");
  return seen;
  };
  const once = await look();
  if (!once.length) return once;
  const kind = (s) => s.split(' (')[0];
  let changes = 0, wake = null;
  const watch = new MutationObserver(() => { changes++; if (wake) wake(); });
  watch.observe(document, { subtree: true, childList: true, attributes: true });
  const changeOr = (ms) => new Promise((done) => { const t = setTimeout(() => { wake = null; done(); }, Math.max(0, ms)); wake = () => { clearTimeout(t); wake = null; done(); }; });
  const until = Date.now() + 2000;
  let again = once.map(kind), seen = changes;
  while (Date.now() < until) {
    if (changes === seen) await changeOr(again.length ? until - Date.now() : Math.min(500, until - Date.now()));
    if (!again.length && changes === seen) break;
    seen = changes;
    again = (await look()).map(kind);
  }
  watch.disconnect();
  return once.filter((s) => again.includes(kind(s)));
})()`;

/** the plain warning when the page looks unstyled ('' when it looks right); failed = style / font files that did not load */
export async function lookNote(page: Page, failed: string[]): Promise<string> {
  const seen = ((await page.evaluate(LOOK_RULES).catch(() => [])) as string[]).filter((s) => !(failed.length && s.startsWith('a style file')));
  const all = [...(failed.length ? [`a style file did not load (${failed.slice(0, 5).join(', ')})`] : []), ...seen];
  return all.length ? `${LOOK_WARNING}${all.join('; ')}${LOOK_WHY}` : '';
}

/** proves the app opened signed in and, once it did, warns on the run screen when it looks unstyled (never a silent pass) */
export async function provedAndLooked(page: Page, prove: () => Promise<string | null>): Promise<string | null> {
  const watch = watchStyleLoads(page);
  try {
    const why = await prove();
    if (!why) {
      const note = await lookNote(page, watch.failed());
      if (note) emit('warn', { text: note });
    }
    return why;
  } finally {
    watch.stop();
  }
}
