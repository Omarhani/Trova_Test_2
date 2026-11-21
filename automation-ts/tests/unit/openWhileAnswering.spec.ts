import { expect, test } from '@playwright/test';
import { OPEN_FROZEN, openWhileAnswering } from '../../src/web/openWhileAnswering';
import { kindOf } from '../../src/report/failureKind';

/**
 * A proof run (its first round, Delete): the app's address answered, then the run's browser stopped answering and the case's
 * page open waited 5 minutes ("Test timeout ... while setting up page"). The open now ends as soon as the browser has
 * not answered for the limit - a set-up problem in plain words, tried once more in a browser of its own.
 */

const never = (): Promise<void> => new Promise(() => undefined);

test('an open on a browser that stopped answering ends after the limit with the plain reason', async () => {
  const page = { evaluate: () => new Promise(() => undefined) };
  const started = Date.now();
  const error = await openWhileAnswering(page as never, never, { everyMs: 10, limitMs: 60 }).catch((e: unknown) => e);
  expect(Date.now() - started).toBeLessThan(1000);
  expect(String(error)).toContain(OPEN_FROZEN);
  expect(kindOf(`${(error as Error).name}: ${(error as Error).message}`).kind).toBe('setup');
});

test('a slow open on a browser that answers is waited for, as before', async () => {
  const page = { evaluate: async () => 1 };
  let opened = false;
  const open = async (): Promise<void> => { await new Promise((r) => setTimeout(r, 200)); opened = true; };
  await openWhileAnswering(page as never, open, { everyMs: 10, limitMs: 60 });
  expect(opened).toBe(true);
});

test('a page loading a new address (its answers are errors) is alive', async () => {
  const page = { evaluate: async () => { throw new Error('Execution context was destroyed'); } };
  const open = (): Promise<void> => new Promise((r) => setTimeout(r, 200));
  await expect(openWhileAnswering(page as never, open, { everyMs: 10, limitMs: 60 })).resolves.toBeUndefined();
});

test('the open\'s own error goes on as it was', async () => {
  const page = { evaluate: async () => 1 };
  await expect(openWhileAnswering(page as never, async () => { throw new Error('refused'); })).rejects.toThrow('refused');
});
