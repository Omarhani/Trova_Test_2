import { Page } from '@playwright/test';
import { coveredNow } from './covers';
import { anyRequestOpen, requestsInFlight } from './netBusy';

/** a known loading layer holds the count back at most this long - one that never goes (opacity tricks) is no answer */
export const COVER_MS = 5_000;
/** the expected count is read twice this far apart */
export const CONFIRM_MS = 300;

/**
 * "0 rows" could be read while the search was still on its way, a pass that never saw the result. A
 * count is read only while the page is not loading - none of its own calls waiting for an answer and no known loading
 * layer (for the first 5 s) - and the expected count is seen on two reads 0.3 s apart. The count read last when the
 * expected one never came; -1 when the list never finished loading - never the expected count without having seen it.
 */
export async function countWhenLoaded(page: Page, count: () => Promise<number>, expected: number, seconds: number): Promise<number> {
  const start = Date.now();
  const until = start + seconds * 1000;
  let last: number | null = null;
  let matched = false;
  for (;;) {
    if (!(await busy(page, start))) {
      last = await count();
      if (last === expected && matched) return last;
      matched = last === expected;
    } else {
      matched = false;
    }
    if (Date.now() >= until && !matched) break;
    await page.waitForTimeout(matched ? CONFIRM_MS : 150);
  }
  return last !== null && last !== expected ? last : -1;
}

/**
 * a short call open, or a loading layer while it may still mean loading: the 5 s cap on the layer holds only when no call
 * at all is open (review of PR 994: a search answering after 10 s+ under its spinner never reads as a mid-search 0)
 */
async function busy(page: Page, start: number): Promise<boolean> {
  if (requestsInFlight(page) > 0) return true;
  if (!(await coveredNow(page))) return false;
  return Date.now() - start < COVER_MS || anyRequestOpen(page);
}
