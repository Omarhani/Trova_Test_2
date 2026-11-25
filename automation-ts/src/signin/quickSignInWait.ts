import { CodeWindow } from '../web/signin/codeWindow';
import { usesCode } from '../web/signin/codeWait';
import { setUpSaid } from '../report/failureKind';

/** the quick sign-in's calls made inside the app's code window */
export type QuickWait = <T>(login: string, recipe: unknown, attempt: () => Promise<T>) => Promise<T>;

/**
 * every quick sign-in (the suite's "Log in programmatically", the API tests, a web case) waits the
 * app's code window ONCE - only a recipe with a code step is a code request. Still refused after that = a refusal.
 */
export function quickSignInWait(window: Pick<CodeWindow, 'run'>): QuickWait {
  return (login, recipe, attempt) => window.run(login, attempt, async () => false, usesCode(recipe));
}

/** a failed quick sign-in: a network break (the next try signs in again) or a refusal (never again in the run) */
export function quickFailure(e: unknown): 'break' | 'refused' {
  return setUpSaid(`${e instanceof Error ? e.name : ''}: ${e instanceof Error ? e.message : String(e)}`) ? 'break' : 'refused';
}
