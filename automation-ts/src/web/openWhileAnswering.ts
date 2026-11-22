import type { Page } from '@playwright/test';
import { SetUpProblem } from '../report/failureKind';
import { FROZEN_LIMIT_MS } from './frozenPage';

/** the case's reason when the browser stopped answering while its page opened - plain words, a set-up problem */
export const OPEN_FROZEN = "The browser stopped answering while the case's page opened - not the app's answer";

/**
 * A proof run (its first round, Delete): the app's address answered, then the run's browser stopped answering and the
 * case's page open waited its whole 5 minutes. While the page opens, the browser is asked a trivial question every
 * everyMs; ONE question left with no reply at all for limitMs (60 s) ends the open at once with OPEN_FROZEN (BLOCKED,
 * tried once more - the next try opens a browser of its own). Any reply, an error while it loads included, is alive,
 * so a long sign-in on a page that answers is waited for as before.
 */
export function openWhileAnswering(page: Pick<Page, 'evaluate'>, open: () => Promise<void>,
                                   o = { everyMs: 5_000, limitMs: FROZEN_LIMIT_MS }): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let askedAt = 0; // when the question still waiting was asked; 0 = none waiting
    let done = false;
    const end = (fn: () => void): void => {
      if (done) return;
      done = true;
      clearInterval(look);
      fn();
    };
    const look = setInterval(() => {
      if (askedAt && Date.now() - askedAt >= o.limitMs) return end(() => reject(new SetUpProblem(OPEN_FROZEN)));
      if (askedAt) return;
      askedAt = Date.now();
      page.evaluate(() => 1).then(() => undefined, () => undefined).finally(() => { askedAt = 0; });
    }, o.everyMs);
    open().then(() => end(resolve), (e: unknown) => end(() => reject(e)));
  });
}
