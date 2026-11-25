import { recipeFor, setScreenFirst } from '../../signin/signIns';
import { runSignInBook } from '../../signin/runSignInBook';
import { ScreenFirstDeps } from '../../signin/screenFirst';
import { joinSharedBrowser, sharedTab } from '../sharedBrowser';
import { openSignedInOn } from '../signedInPage';
import { quickKnown, screenKnown } from './signInWays';
import { keptState } from './keptSignIn';
import { openShown } from './signInOpenShown';
import { checkTrue } from '../../report/checks';
import { currentStep } from '../../report/stepNumbers';
import { stepPictures } from '../stepPictures';

/** the picture of the page now, as a step picture of the running test (at most 5 s) */
async function pictureNow(tab: import('@playwright/test').Page): Promise<void> {
  stepPictures.shoot(tab, currentStep());
  await Promise.race([stepPictures.done(tab), new Promise((r) => setTimeout(r, 5000))]);
}

/**
 * The run's real screen-first sign-in - the run's one browser opened signed in on the sign-in screen (the
 * sign-in gate saves its whole state for the run), the token then read from that saved state.
 */
export const SCREEN_FIRST: ScreenFirstDeps = {
  apiProven: (login) => quickKnown(login), // sign-in calls first: any recipe before the screen
  screenKnown: (login) => screenKnown(login),
  kept: (login) => { // the sign-in the platform kept (the writer's own) goes first
    try {
      return keptState(login) !== undefined;
    } catch {
      return false;
    }
  },
  saved: (login) => runSignInBook.saved(login),
  openOnScreen: async (login) => {
    const { browser, own } = await joinSharedBrowser();
    const tab = await sharedTab(browser);
    // one sign-in line (the sign-in test's own) and the picture of the app after the sign-in
    await openShown(login, (proved) => openSignedInOn(tab, login, proved), {
      onScreen: () => runSignInBook.saved(login)?.onScreen === true,
      check: (text) => checkTrue(text, true),
      picture: () => pictureNow(tab),
    });
    if (own) await browser.close(); // the state is saved for the run; a browser of its own is not left open
  },
  recipe: (login) => {
    try {
      return recipeFor(login, 'web');
    } catch {
      return undefined;
    }
  },
};

/** in force once this file is loaded (by the base of every test, trovaTest) */
setScreenFirst(SCREEN_FIRST);
