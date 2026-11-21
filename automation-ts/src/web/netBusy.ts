import { Page, Request } from '@playwright/test';

/** a request open longer than this is the app's own long wait (live updates), never the list's answer */
export const LONG_POLL_MS = 10_000;

const open = new WeakMap<Page, Map<Request, number>>();

/**
 * Session #358: the page's own calls (xhr / fetch) are followed from the first page object on - a search sent by pressing
 * Enter is still on its way while the list shows no rows. Once per page; never fails.
 */
export function followRequests(page: Page): void {
  if (open.has(page) || typeof page.on !== 'function') return;
  const going = new Map<Request, number>();
  open.set(page, going);
  page.on('request', (r) => { if (['xhr', 'fetch'].includes(r.resourceType())) going.set(r, Date.now()); });
  const done = (r: Request) => { going.delete(r); };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
}

/** the page's own calls still waiting for their answer (long waits left out) */
export function requestsInFlight(page: Page, now = Date.now()): number {
  let n = 0;
  for (const since of open.get(page)?.values() ?? []) if (now - since < LONG_POLL_MS) n++;
  return n;
}

/** any of the page's own calls still open, long waits too */
export function anyRequestOpen(page: Page): boolean {
  return (open.get(page)?.size ?? 0) > 0;
}
