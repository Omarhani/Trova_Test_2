import type { SuiteBlock } from './suitePlan';

/**
 * A proof run goes through the suite's whole chain once per try - the case that makes a record, the cases that use
 * it, the case that deletes it - then again, so every try starts clean and leaves nothing behind. The sign-in block
 * runs in the first try only (the run keeps its sign-in). Playwright's own repeat would run each block several times
 * before the next one and break the chain.
 */
export function chainTries(blocks: SuiteBlock[], tries: number): SuiteBlock[] {
  const n = Number.isInteger(tries) && tries >= 2 && tries <= 5 ? tries : 1;
  const again = blocks.filter((b) => !signInOnly(b));
  const out = [...blocks];
  for (let k = 2; k <= n; k++) out.push(...again);
  return out;
}

/** how many tries the run asks for (TROVA_REPEAT, 2-5), else 1 */
export function triesFrom(env: Record<string, string | undefined>): number {
  const n = Number(env.TROVA_REPEAT?.trim());
  return Number.isInteger(n) && n >= 2 && n <= 5 ? n : 1;
}

function signInOnly(block: SuiteBlock): boolean {
  return block.tests.length > 0
    && block.tests.every((t) => /^tests\/api\/signIn\//i.test(t.spec.replace(/\\/g, '/').replace(/^\.?\//, '')));
}
