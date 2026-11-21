import { SignInResult } from '../api/client/recipe/recipeSignIn';
import { JsonObject } from '../api/client/recipe/json';
import { tokenOf } from './browserToken';
import { SavedSignIn } from './savedSignIn';
import { SignInProblem } from '../report/failureKind';

/**
 * Review 980: the app refused the quick sign-in earlier in the run (any worker) - the API side takes the token of the
 * sign-in made on the screen, its whole browser state as the kept values. None, or no token in it = the refusal in plain
 * words. Never the refused sign-in calls again (repeated refusals can lock the account). Never prints a value.
 */
export function screenSignInToken(refused: string, saved: SavedSignIn | undefined, recipe: JsonObject | undefined): SignInResult {
  if (!saved) throw new SignInProblem(refused);
  const local = saved.storage.origins.find((o) => o.origin === saved.origin)?.localStorage ?? [];
  const browser: SignInResult['browser'] = {
    localStorage: Object.fromEntries(local.map((x) => [x.name, x.value])),
    sessionStorage: { ...saved.sessionStorage },
    cookies: Object.fromEntries(saved.storage.cookies.map((c) => [c.name, c.value])),
  };
  const token = tokenOf(browser, recipe);
  if (!token) throw new SignInProblem(`${refused} - and the sign-in made on the screen holds no token the app's calls can use`);
  return { token, browser };
}
