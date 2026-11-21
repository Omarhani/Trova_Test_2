import { Page } from '@playwright/test';
import { runMode } from '../../run/runMode';
import { browserSignIns } from '../../signin/browserSignInFile';
import { renewDue } from '../../signin/savedSignIn';
import { runSignInBook } from '../../signin/runSignInBook';
import { SignInGate } from '../../signin/signInGate';
import { apiSignInto } from './apiSignInto';
import { apiSignInShown } from './apiSignInShown';
import { proveSignedIn } from './appProof';
import { putState } from './browserPut';
import { heldLogin, holdLogin } from './heldLogin';
import { captureSaved, putSaved } from './savedState';
import { screenSignInto } from './screenSignInto';
import { quickKnown, screenKnown } from './signInWays';
import { codeWindow } from './codeClock';
import { keptEnded, keptState, recipeProven, screenRecipe } from './keptSignIn';
import { pageSays } from './signInPage';
import { saysTooSoon, usesCode } from './codeWait';
import { checkTrue } from '../../report/checks';
import { openedLine } from './signInOpenShown';

/** the run's sign-in gate on the run's one tab, in the suite's mode (hybrid: the app's API; ui: the sign-in page) */
export function webGate(page: Page, web: string, proved: (login: string) => void = (login) => checkTrue(openedLine(login), true)): SignInGate {
  return new SignInGate({
    mode: runMode(),
    book: runSignInBook,
    held: heldLogin,
    hold: holdLogin,
    // session #355: a new one-time code only once the app allows it (waited in plain words), never in a loop
    // a refused quick sign-in shows its step; its code window is waited inside the quick sign-in
    byApi: (login, fresh) => apiSignInShown(page, login, () => apiSignInto(page, web, login, fresh)),
    // review 988: only the page's words saying "wait for a new code" count, and only a sign-in with a code step is a code request
    byScreen: (login) => codeWindow.run(login, () => screenSignInto(page, web, login), () => saysTooSoon(() => pageSays(page)),
      usesCode(screenRecipe(login))),
    apiProven: quickKnown, // Prod rule (API FIRST): any sign-in recipe before the screen; none = once on the screen
    putKept: async (login) => { // HARD RULE one login per run: the sign-in Trova kept goes first
      const kept = keptState(login);
      if (kept) await putState(page, kept.state, new URL(web).origin);
      return !!kept;
    },
    dropKept: (login) => keptEnded(login), // review 988: a rejected kept sign-in is forgotten (2-7 s saved per later run)
    quickProven: (login) => recipeProven(login), // session #356: the prefilled quick sign-in worked - Trova counts it learned
    screenKnown,
    browser: (login) => browserSignIns.look(login),
    putBrowser: (saved) => putState(page, saved.browser, saved.origin || new URL(web).origin),
    capture: () => captureSaved(page, web),
    put: (saved) => putSaved(page, saved),
    prove: () => proveSignedIn(page, web),
    renewDue: (saved) => renewDue(saved),
    now: () => Date.now(),
    say: (line) => console.log(line),
    proved, // the tick only once seen (the sign-in test gives its own)
  });
}
