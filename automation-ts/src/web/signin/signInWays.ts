import { recipeFor } from '../../signin/signIns';
import { sharedSignIn } from '../../signin/sharedSignIn';
import { screenRecipe } from './keptSignIn';
import { SignInResult } from '../../api/client/recipe/recipeSignIn';
import { JsonObject } from '../../api/client/recipe/json';

/** what apiProven reads: Trova's shared sign-in of the login (throws = refused), the login's web recipe (throws = none) */
export interface ProvenDeps {
  shared: (login: string) => SignInResult | undefined;
  recipe: (login: string) => JsonObject;
}

const DEPS: ProvenDeps = {
  shared: (login) => sharedSignIn(login, false),
  recipe: (login) => recipeFor(login, 'web'),
};

/**
 * The login's sign-in call is known and proven on this environment - Trova's shared sign-in
 * worked, or the login has its sign-in recipe and Trova's own sign-in was not refused. Else the run signs in on the
 * screen once and keeps the full browser state (the kept sign-in). A recipe Trova only prefilled from a
 * seed is not proven.
 */
export function apiProven(login: string, d: ProvenDeps = DEPS): boolean {
  try {
    if (d.shared(login)) return true;
  } catch {
    return false; // Trova's own sign-in behind the screens was refused
  }
  try {
    const source = d.recipe(login).source;
    return !(typeof source === 'string' && source.startsWith('Prefilled'));
  } catch {
    return false;
  }
}

/**
 * API FIRST: the login has a quick sign-in to try before the screen -
 * a proven one, or any recipe Trova has (a prefilled one too). Its shared sign-in refused = none.
 */
export function quickKnown(login: string, d: ProvenDeps = DEPS): boolean {
  if (apiProven(login, d)) return true;
  try {
    d.shared(login);
    return d.recipe(login).calls !== undefined;
  } catch {
    return false;
  }
}

/** the login has saved sign-in steps for the sign-in screen */
export function screenKnown(login: string): boolean {
  try {
    return screenRecipe(login) !== undefined;
  } catch {
    return false;
  }
}
