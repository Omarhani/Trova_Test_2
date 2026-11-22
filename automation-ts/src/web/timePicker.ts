import { Locator, Page } from '@playwright/test';
import { emit } from '../report/liveEvents';
import { nextStep } from '../report/stepNumbers';
import { locate } from './anyOf';
import { ClockDialog, DIALOG } from './clockDialog';
import { ClockTime } from './clockTime';
import { settle } from './covers';

/** a plain or native time box (not read-only, no clock dialog behind it) */
async function takesTyping(input: Locator): Promise<boolean> {
  return input.evaluate((e) => {
    const readonly = e.getAttribute('readonly');
    return !(readonly !== null && readonly !== 'false') && e.getAttribute('mattimepicker') === null;
  });
}

async function type(input: Locator, text: string, want: ClockTime): Promise<void> {
  if ((await input.getAttribute('type'))?.toLowerCase() === 'time') { // a native time box takes HH:mm by script
    await input.evaluate((e, v) => {
      const box = e as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(box, v);
      box.dispatchEvent(new Event('input', { bubbles: true }));
      box.dispatchEvent(new Event('change', { bubbles: true }));
    }, want.hhmm);
    return;
  }
  await input.fill('');
  await input.fill(text);
  await input.press('Tab');
}

/** the field's value once it shows the time, at most seconds; what it shows otherwise */
async function readBack(page: Page, input: Locator, want: ClockTime, seconds: number): Promise<string> {
  const until = Date.now() + seconds * 1000;
  for (;;) {
    const shown = (await input.inputValue().catch(() => '')).trim();
    if (want.matches(shown) || Date.now() >= until) return shown;
    await page.waitForTimeout(200);
  }
}

/**
 * Sets a time field in one call: setTime(page, this.shiftStart, '18:00', 10, 'Shift start'). A field that takes typing
 * gets the time typed; a read-only one opens its clock dialog and the clock is worked the one known way (ClockDialog).
 * Then the field is read back until it shows the time ("6:00 pm" or "18:00"); gives back what it shows. Fails in plain
 * words naming the field.
 */
export async function setTime(page: Page, field: string, time: string, seconds = 10, name?: string): Promise<string> {
  const want = ClockTime.parse(time);
  const s = Math.max(1, seconds);
  const what = name?.trim() ? `The ${name.trim()} field` : 'The time field';
  await settle(page, s * 1000);
  const input = locate(page, field).filter({ visible: true }).first();
  const there = await input.waitFor({ state: 'visible', timeout: s * 1000 }).then(() => true, () => false);
  if (!there) throw new Error(`${what} was not on the screen within ${s} s`);
  emit('step', { n: nextStep(), a: 'type', e: name?.trim() || 'time', l: field.slice(0, 160), v: time.trim() });
  await settle(page, s * 1000);
  if (await takesTyping(input)) {
    await type(input, time.trim(), want);
  } else {
    await input.click({ timeout: s * 1000 });
    const opened = await page.locator(DIALOG).waitFor({ state: 'visible', timeout: s * 1000 }).then(() => true, () => false);
    if (!opened) throw new Error(`${what}'s clock did not open within ${s} s`);
    await new ClockDialog(page, what).choose(want, s);
  }
  const shown = await readBack(page, input, want, s);
  if (!want.matches(shown)) throw new Error(`${what} shows "${shown}" after choosing ${want}`);
  return shown;
}
