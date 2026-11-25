import type { Kind } from './failureKind';

/** Playwright's own words when a case ran out of its time: "Test timeout of 300000ms exceeded (while setting up "page")." */
const TEST_TIMEOUT = /^Test timeout of (\d+)ms exceeded(?: while setting up "page")?/;

/** "5 minutes" / "90 seconds" - never "ms" */
function inWords(ms: number): string {
  const minutes = ms / 60_000;
  return Number.isInteger(minutes) ? `${minutes} minute${minutes === 1 ? '' : 's'}` : `${Math.round(ms / 1000)} seconds`;
}

/**
 * A proof run: a case that ran out of its time in plain words, always FAILED. Its page set-up holds the sign-in and
 * opening the app's page, so an app that never opens must show - only a browser that stopped answering is the platform's own
 * set-up problem (OPEN_FROZEN). undefined = not a case timeout.
 */
export function testTimeout(text: string): { kind: Kind; reason: string } | undefined {
  const m = TEST_TIMEOUT.exec(text);
  if (!m) return undefined;
  const time = inWords(Number(m[1]));
  return { kind: 'failed', reason: m[0].includes('setting up') ? `The app's page did not open within ${time}` : `The case did not finish within ${time}` };
}
