/**
 * A proof run goes through the suite 3 times, and each round must make its own user names and numbers - the second
 * round reusing the first round's values was refused by the app ("already exists"). The runner lists the stamps it put
 * in place of {run} in the suite parameter trova.stamps, then each later round's own stamps in the same order:
 * "s1,v1|s2,v2|s3,v3" - one stamp per round, made like a run's own, never round 1's with a digit moved. Round 1 keeps
 * the run's own values; a round the runner listed no stamps for (or a suite with no stamps) keeps its values as they are.
 */
export const STAMPS = 'trova.stamps';

const list = (part: string | undefined): string[] => (part ?? '').split(',').map((s) => s.trim()).filter((s) => s.length >= 4);

/** the block's parameters for this round: each of round 1's stamps in a value replaced by this round's own */
export function roundParams(params: Record<string, string>, round: number): Record<string, string> {
  const rounds = (params[STAMPS] ?? '').split('|');
  const first = list(rounds[0]);
  const own = list(rounds[round - 1]);
  if (round <= 1 || first.length === 0 || own.length !== first.length) return params;
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(params)) {
    out[name] = name === STAMPS ? value : first.reduce((text, s, i) => text.split(s).join(own[i]), value);
  }
  return out;
}
