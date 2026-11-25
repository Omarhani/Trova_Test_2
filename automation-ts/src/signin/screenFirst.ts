import { AsyncLocalStorage } from 'node:async_hooks';
import { SignInResult } from '../api/client/recipe/recipeSignIn';
import { JsonObject } from '../api/client/recipe/json';
import { SavedSignIn } from './savedSignIn';
import { screenSignInToken } from './screenSignInToken';

/** what the screen-first sign-in stands on: the way's facts, the run's saved sign-in, a sign-in on the screen */
export interface ScreenFirstDeps {
  apiProven: (login: string) => boolean;
  screenKnown: (login: string) => boolean;
  /** The platform kept a sign-in of the login (the writer's own, an earlier run's) - it goes first */
  kept?: (login: string) => boolean;
  saved: (login: string) => SavedSignIn | undefined;
  openOnScreen: (login: string) => Promise<void>;
  recipe: (login: string) => JsonObject | undefined;
}

const NOT_PROVEN = 'No quick sign-in is proven on this app';

/**
 * One sign-in per login and run: a sign-in the platform kept (the writer's own, an earlier run's) goes first -
 * the run's one browser opens with it, proved, and the app's calls use its token; no new sign-in.
 * The kept sign-in: with no proven quick sign-in and the screen's steps known, the run's one
 * sign-in is made ONCE on the sign-in screen (its whole browser state kept for every test) and the app's calls use its
 * token - never the quick sign-in calls. undefined = the quick sign-in is proven, or no screen steps: as before.
 */
/** one open per login (another login opens its own); inside = the login whose open runs in this call chain */
const opening = new Map<string, Promise<void>>();
const inside = new AsyncLocalStorage<string>();

export async function screenFirst(login: string, d: ScreenFirstDeps): Promise<SignInResult | undefined> {
  const key = login.trim().toLowerCase();
  if (inside.getStore() === key) return undefined; // the gate's own quick sign-in inside the kept try: the recipe, never this again
  const kept = d.kept?.(login) ?? false; // the run's saved sign-in (from it or made this run) is reused, never a new one
  if (!kept && (d.apiProven(login) || !d.screenKnown(login))) return undefined;
  if (!d.saved(login)) await openOnce(key, () => d.openOnScreen(login));
  return screenSignInToken(NOT_PROVEN, d.saved(login), d.recipe(login));
}

/** the login's one open: a second sign-in of the same login at once waits for it and reuses it */
async function openOnce(key: string, open: () => Promise<void>): Promise<void> {
  let pending = opening.get(key);
  if (!pending) {
    pending = inside.run(key, open).finally(() => opening.delete(key));
    opening.set(key, pending);
  }
  await pending;
}
