import { Browser, Page } from '@playwright/test';
import { blockedSkip } from '../report/blockedSkip';
import { param } from '../run/blockParams';
import { runLogin } from '../run/credentials';
import { trovaTest } from '../run/trovaTest';
import { runSignInBook } from '../signin/runSignInBook';
import { SkipLogin } from '../signin/skipLogin';
import { keepTestEnd } from './lastScreen';
import { openKeepingEnd } from './openKeepingEnd';
import { joinSharedBrowser, sharedTab } from './sharedBrowser';
import { openSignedInOn } from './signedInPage';
import { watchFrozen } from './frozenPage';
import { picturesAfterChecks, stepPictures } from './stepPictures';

/**
 * The web test base: the run's ONE browser and tab for every block (as the Java suites keep one browser per
 * suite), the block's login opened in it with the run's ONE sign-in of that
 * login (SignInGate: signed in once, then reused and proved, never signed in again by a case), its calls, console and step pictures on the run screen; on a failure the page's address, its menu texts
 * and the last screen of every test, passed or failed, as base.BaseTests keeps it.
 */
export const webTest = trovaTest.extend<{ page: Page; refusedLogin: void }, { browser: Browser; tab: Page }>({
  // the app refused this login's sign-in earlier in the run: skipped at once, before the browser is touched (Java: SKIPPED)
  refusedLogin: [async ({ trovaCase }, use, testInfo) => {
    void trovaCase; // after the case's own guard
    const no = refusalOf(param('signedInAs', ''));
    if (no !== undefined) blockedSkip(testInfo, 'signin', no);
    await use();
  }, { auto: true }],
  browser: [async ({}, use) => {
    const { browser, own } = await joinSharedBrowser();
    await use(browser);
    if (own) await browser.close();
  }, { scope: 'worker' }],
  tab: [async ({ browser }, use) => {
    await use(await sharedTab(browser));
  }, { scope: 'worker' }],
  page: async ({ tab }, use, testInfo) => {
    const keepScreen = (): Promise<void> => keepTestEnd(tab, (name, a) => testInfo.attach(name, a), true);
    await openKeepingEnd(() => openSignedInOn(tab, runLogin(param('signedInAs', ''))), keepScreen).catch((e: unknown) => {
      if (e instanceof SkipLogin) blockedSkip(testInfo, 'signin', e.message);
      throw e;
    });
    const stopPictures = picturesAfterChecks(tab);
    const stopWatch = watchFrozen(tab); // a frozen page ends the case in 20 s, BLOCKED - never its 5 minutes
    await use(tab);
    stopWatch();
    stopPictures();
    await Promise.race([stepPictures.done(tab), new Promise((r) => setTimeout(r, 5000))]); // the last step's picture first
    await keepTestEnd(tab, (name, a) => testInfo.attach(name, a), testInfo.status !== testInfo.expectedStatus);
  },
});

function refusalOf(blockLogin: string): string | undefined {
  try {
    return runSignInBook.refused(runLogin(blockLogin));
  } catch {
    return undefined; // no login set: the page says so
  }
}
