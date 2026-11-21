import { expect, test } from '@playwright/test';
import type { KeptPhone } from '../../src/phone/keptPhone';
import { BlockPhoneDeps, phoneForBlock } from '../../src/phone/phoneForBlock';
import type { Phone } from '../../src/phone/phoneSession';

/**
 * The first phone block joins the session the run opened early: the app was just started as a new session starts it,
 * so it is not started again (that cost ~20 s). Every later block starts the app as a new session would.
 */

const PHONE = { sessionId: 's1' } as unknown as Phone;

function deps(kept: KeptPhone | undefined, log: string[]): BlockPhoneDeps {
  return {
    kept: () => kept,
    attach: async () => PHONE,
    open: async () => { log.push('open'); return PHONE; },
    freePort: async () => 9100,
    save: (_p, port) => log.push(`save ${port}`),
    forget: () => log.push('forget'),
    reset: async (_p, keep) => { log.push(`reset ${keep ? 'keep' : 'clear'}`); },
    launch: async () => { log.push('launch'); },
    end: async () => { log.push('end'); },
  };
}

const KEPT: KeptPhone = { runId: 'r1', sessionId: 's1', filmPort: 9001, capabilities: {} };

test('fresh + keep data: the app the early session left closed is started once, after the earlier blocks', async () => {
  const log: string[] = [];
  const block = await phoneForBlock(true, deps({ ...KEPT, fresh: true, appStarted: false }, log));
  expect(block.filmPort).toBe(9001);
  expect(log).toEqual(['launch', 'save 9001']); // started now (it reads what the earlier blocks made), never reset
});

test('a fresh session whose app was already started is used as it is', async () => {
  const log: string[] = [];
  await phoneForBlock(true, deps({ ...KEPT, fresh: true }, log));
  expect(log).toEqual(['save 9001']); // only the fresh mark goes
});

test('a fresh session with the app data cleared is used as it is too', async () => {
  const log: string[] = [];
  await phoneForBlock(false, deps({ ...KEPT, fresh: true }, log));
  expect(log).toEqual(['save 9001']);
});

test('a later block starts the app again, keeping or clearing its data as asked', async () => {
  const log: string[] = [];
  await phoneForBlock(true, deps(KEPT, log));
  await phoneForBlock(false, deps(KEPT, log));
  expect(log).toEqual(['reset keep', 'reset clear']);
});

test('no kept session: a new one is opened and kept', async () => {
  const log: string[] = [];
  await phoneForBlock(true, deps(undefined, log));
  expect(log).toEqual(['open', 'save 9100']);
});
