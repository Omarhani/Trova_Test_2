import { Page } from '@playwright/test';
import { emit } from '../../report/liveEvents';
import { signInStepShown } from './signInStepShown';

type Say = (type: string, fields: Record<string, unknown>) => void;

/**
 * A refused quick sign-in left every test with "No steps were recorded". The quick
 * sign-in is a run-page step ("Log in programmatically as <login>"), and where it stopped shows with the app's words
 * and the browser's picture of that moment. go answers null = signed in, else why not.
 */
export async function apiSignInShown(page: Page, login: string, go: () => Promise<string | null>, say: Say = emit): Promise<string | null> {
  signInStepShown(page, 'Log in programmatically as', { e: login }, say);
  try {
    const why = await go();
    if (why) signInStepShown(page, 'sign-in stopped', { e: why }, say);
    return why;
  } catch (e) {
    signInStepShown(page, 'sign-in stopped', { e: e instanceof Error ? e.message : String(e) }, say);
    throw e;
  }
}
