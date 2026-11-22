import { Page, Request, Response } from '@playwright/test';
import { emit } from '../../report/liveEvents';

/**
 * Bug 130 (run #242): after "Log in programmatically" the app opened signed in but its side menu had lost its look, and
 * the run passed silently. A quick look at the page right after the sign-in, for any app: no style source at all (style
 * files, inline styles, adopted sheets, web components' own styles all count), a style or font file that did not load, the
 * app's colour settings not in effect. Plain words only; it never blocks a case, and its warning reaches the run screen.
 * The rule list and wording are the same in Java's PageLook and the AI's trova-page-look (PageLookParityTest keeps them so).
 */

/** the one wording of the warning, in Java, TS and agent-tools alike */
export const LOOK_WARNING = 'Warning: the page opened signed in but looks unstyled - ';
const LOOK_WHY = '. A setting the app keeps in the browser (its theme or language) may be missing from the sign-in Trova put back, or a style file is not reachable.';

/** the style and font files of the app that failed to load from now on (their file names) */
export function watchStyleLoads(page: Page): { failed: () => string[]; stop: () => void } {
  const failed = new Set<string>();
  const kind = (r: Request): boolean => ['stylesheet', 'font'].includes(r.resourceType());
  const name = (url: string): string => url.replace(/[?#].*$/, '').split('/').filter(Boolean).pop() || url;
  const onFail = (r: Request): void => { if (kind(r)) failed.add(name(r.url())); };
  const onAnswer = (a: Response): void => { if (kind(a.request()) && a.status() >= 400) failed.add(name(a.url())); };
  page.on('requestfailed', onFail);
  page.on('response', onAnswer);
  return {
    failed: () => [...failed],
    stop: () => { page.off('requestfailed', onFail); page.off('response', onAnswer); },
  };
}

/** page code: what looks unstyled now (empty = looks right) - the shared rule list */
export const LOOK_RULES = `(() => {
  const seen = [];
  const roots = [];
  const walk = (root) => { for (const el of root.querySelectorAll('*')) if (el.shadowRoot) { roots.push(el.shadowRoot); walk(el.shadowRoot); } };
  walk(document);
  const ruled = (s) => { try { return s.cssRules.length > 0; } catch (e) { return true; } };
  const sheets = [...document.styleSheets, ...(document.adoptedStyleSheets || [])].filter(ruled);
  const inner = roots.flatMap((r) => [...r.styleSheets, ...(r.adoptedStyleSheets || [])]).filter(ruled);
  const inline = !!document.querySelector('[style]') || roots.some((r) => !!r.querySelector('[style]'));
  if (!sheets.length && !inner.length && !inline) seen.push('no styles are applied');
  const fileOf = (u) => u.replace(/[?#].*$/, '').split('/').filter(Boolean).pop() || u;
  const lost = [...document.querySelectorAll('link[rel~=stylesheet][href]')].filter((l) => !l.sheet).map((l) => fileOf(l.href));
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
  const lostSettings = new Set();
  for (const x of styleRules) {
    const el = first(x);
    if (!el) continue;
    for (const n of usedIn(x.r.style.cssText)) {
      if (lostSettings.has(n) || !declared.has(n) || getComputedStyle(el).getPropertyValue(n).trim()) continue;
      if (!declared.get(n).some((d) => !!first(d))) lostSettings.add(n);
    }
  }
  if (lostSettings.size) seen.push("the app's colour settings are empty");
  return seen;
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
