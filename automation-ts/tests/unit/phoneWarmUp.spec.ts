import { expect, test } from '@playwright/test';
import type { KeptPhone } from '../../src/phone/keptPhone';
import { warmPhone, WarmDeps } from '../../src/phone/phoneWarmUp';

/**
 * The run's phone is opened while the earlier blocks run. When the first phone block keeps the app's data, the app is
 * NOT started yet (it would show the last run's screen while the earlier blocks still make records): the block starts it.
 */

function deps(seen: { launch?: boolean; saved?: Partial<KeptPhone> }): WarmDeps {
  return {
    held: async () => null,
    freePort: async () => 9001,
    open: async (_port, _keep, launch) => { seen.launch = launch; return { sessionId: 's1', capabilities: {} }; },
    save: (k) => { seen.saved = k; },
    pending: () => undefined,
    say: () => undefined,
  };
}

test('keep data: the early session does not start the app and says so', async () => {
  const seen: { launch?: boolean; saved?: Partial<KeptPhone> } = {};
  await warmPhone(deps(seen), true);
  expect(seen.launch).toBe(false);
  expect(seen.saved).toMatchObject({ fresh: true, appStarted: false });
});

test('cleared data: the app starts at once, as before (nothing old can show)', async () => {
  const seen: { launch?: boolean; saved?: Partial<KeptPhone> } = {};
  await warmPhone(deps(seen), false);
  expect(seen.launch).toBe(true);
  expect(seen.saved).toMatchObject({ fresh: true, appStarted: true });
});
