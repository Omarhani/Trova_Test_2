import { Page } from '@playwright/test';

/**
 * A kept sign-in's values go into and out of the page by Trova's own channel (a page binding) - never
 * as the text, argument or answer of a browser call, which a Playwright trace keeps. Only the channel's name and a
 * call number are in a call. One channel per page, opened once, so channels never pile up on a page.
 */
const CHANNEL = '__trovaHand';

type Slots = Map<number, { give?: unknown; got?: unknown }>;

const opened = new WeakMap<Page, Slots>();
let next = 0;

/** the page's one channel: "give" hands the call its data once, "take" keeps what the call answers */
async function slotsOf(page: Page): Promise<Slots> {
  let slots = opened.get(page);
  if (slots) return slots;
  const own: Slots = new Map();
  opened.set(page, own);
  try {
    await page.exposeBinding(CHANNEL, (_source, op: string, id: number, d?: unknown) => {
      const slot = own.get(id);
      if (!slot) return undefined;
      if (op === 'take') { slot.got = d; return undefined; }
      const given = slot.give;
      slot.give = undefined; // handed over once
      return given;
    });
  } catch (e) {
    opened.delete(page);
    throw e;
  }
  slots = own;
  return slots;
}

/** a fresh call number with its slot on the page's channel; the slot is dropped when the work ends */
async function withSlot<T>(page: Page, give: unknown, work: (id: number) => Promise<T>): Promise<{ answer: T; got: unknown }> {
  const slots = await slotsOf(page);
  next += 1;
  const id = next;
  slots.set(id, { give });
  try {
    const answer = await work(id);
    return { answer, got: slots.get(id)?.got };
  } finally {
    slots.delete(id);
  }
}

/** runs page code (a function source of one argument) that gets `data` through the channel; answers what the code answers when it is a number */
export async function runWith(page: Page, code: string, data: unknown): Promise<number> {
  const { answer } = await withSlot(page, data, (id) => page.evaluate(
    `(async () => { const d = await window.${CHANNEL}('give', ${id}); const r = await (${code})(d); return typeof r === 'number' ? r : 0; })()`));
  return typeof answer === 'number' ? answer : 0;
}

/** runs page code (a function source of no argument) and takes what it answers through the channel */
export async function readWith(page: Page, code: string): Promise<unknown> {
  const { got } = await withSlot(page, undefined, (id) => page.evaluate(
    `(async () => { await window.${CHANNEL}('take', ${id}, await (${code})()); return 0; })()`));
  return got;
}

/** the answer, or `fallback` when it takes longer than `ms` (the page stopped answering) */
export function within<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<T>((ok) => { timer = setTimeout(() => ok(fallback), ms); });
  return Promise.race([work.catch(() => fallback), late]).finally(() => clearTimeout(timer));
}
