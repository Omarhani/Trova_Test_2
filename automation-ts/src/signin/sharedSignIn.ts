import { asObject, asText, byName, section } from '../run/runDataFile';
import { SignInResult } from '../api/client/recipe/recipeSignIn';

/**
 * The ONE sign-in the platform made for this login and environment, shared with everything running at the same time (an assistant
 * run, a writer's try, a suite run) - "signInShared" / "signInSharedPhone" in the run file. Using it means no new
 * one-time code is asked of the app. undefined = the platform made none; throws when the platform's own sign-in was refused.
 */
export function sharedSignIn(login: string, phone: boolean): SignInResult | undefined {
  const one = asObject(byName(section(phone ? 'signInSharedPhone' : 'signInShared'), login));
  if (one.why !== undefined && one.browser === undefined) throw new Error(`The app refused the sign-in: ${asText(one.why)}`);
  if (one.browser === undefined) return undefined;
  const browser: SignInResult['browser'] = { localStorage: {}, sessionStorage: {}, cookies: {} };
  for (const place of ['localStorage', 'sessionStorage', 'cookies'] as const) {
    for (const [k, v] of Object.entries(asObject(asObject(one.browser)[place]))) browser[place][k] = asText(v);
  }
  return { token: asText(one.token), browser };
}
