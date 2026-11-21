import { recipeFor, setScreenFirst } from '../../signin/signIns';
import { runSignInBook } from '../../signin/runSignInBook';
import { ScreenFirstDeps } from '../../signin/screenFirst';
import { joinSharedBrowser, sharedTab } from '../sharedBrowser';
import { openSignedInOn } from '../signedInPage';
import { quickKnown, screenKnown } from './signInWays';
import { keptState } from './keptSignIn';

/**
 * The run's real screen-first sign-in - the run's one browser opened signed in on the sign-in screen (the
 * sign-in gate saves its whole state for the run), the token then read from that saved state.
 */
export const SCREEN_FIRST: ScreenFirstDeps = {
  apiProven: (login) => quickKnown(login), // Prod rule: API FIRST - any recipe before the screen
  screenKnown: (login) => screenKnown(login),
  kept: (login) => { // session #355: the sign-in Trova kept (the writer's own) goes first
    try {
      return keptState(login) !== undefined;
    } catch {
      return false;
    }
  },
  saved: (login) => runSignInBook.saved(login),
  openOnScreen: async (login) => {
    const { browser, own } = await joinSharedBrowser();
    await openSignedInOn(await sharedTab(browser), login);
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
