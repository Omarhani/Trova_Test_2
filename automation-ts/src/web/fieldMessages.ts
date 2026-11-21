import { Locator, Page } from '@playwright/test';
import { locate } from './anyOf';
import { settle } from './covers';
import { withoutClose } from './uiText';

const LOOK_EVERY_MS = 250;
/** a locator as the page objects write them (By.xpath / By.cssSelector / By.id, anyOf, a bare XPath or CSS) */
const LOCATOR = /^(xpath=|css=|text=|id=|trova-anyof=|internal:|\/\/|\(\/\/|[#.[])/;

/** in the page: the message shown for the field (its named hint, then its nearest box), else any shown validation text */
function readMessage(field: Element | null): string {
  const sel = 'mat-error, .mat-error, .mat-mdc-form-field-error, .invalid-feedback, .form-error, .field-error, .error-message,'
    + ' .error-msg, .validation-message, .help-block, .text-danger, .is-invalid ~ small, .ant-form-item-explain-error, .p-error,'
    + ' .el-form-item__error, .v-messages__message, [role=alert], [aria-live=assertive]';
  const txt = (e: Element): string => ((e as HTMLElement).innerText || e.textContent || '').replace(/\s+/g, ' ').trim();
  const shown = (e: Element): boolean => e.getClientRects().length > 0;
  const texts = (root: ParentNode): string[] => {
    const out: string[] = [];
    for (const e of Array.from(root.querySelectorAll(sel))) {
      const t = txt(e);
      if (t && shown(e) && !out.includes(t)) out.push(t);
    }
    return out;
  };
  if (field) {
    for (const id of (field.getAttribute('aria-describedby') ?? '').split(/\s+/)) {
      const named = id ? document.getElementById(id) : null;
      if (named && shown(named) && txt(named)) return txt(named);
    }
    let box: Element = field;
    for (let up = 0; up < 5 && box.parentElement; up++) {
      box = box.parentElement;
      const near = texts(box);
      if (near.length) return near.join(' | '); // the nearest box first: the field's own area
    }
  }
  return texts(document).join(' | ');
}

/** many forms show a field's message only once it is left: blurred (no click elsewhere, no key) */
function leave(e: Element): void {
  if (document.activeElement === e) (e as HTMLElement).blur();
  else {
    e.dispatchEvent(new FocusEvent('blur'));
    e.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  }
}

/** spaces made single, a trailing dot / mark left out: how two messages are compared */
function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim().replace(/[.。!]+$/, '').trim();
}

/** the field by its locator, or by its label when it is given in words ("Hours") */
function fieldOf(page: Page, field: string): Locator {
  return LOCATOR.test(field) ? locate(page, field).first() : page.getByLabel(field).first();
}

async function readNow(page: Page, field: Locator | undefined): Promise<string> {
  const there = field && (await field.count().catch(() => 0)) > 0;
  const text = there ? await field.evaluate(readMessage).catch(() => '') : await page.evaluate(readMessage, null).catch(() => '');
  return withoutClose(text);
}

/**
 * An expected error / validation message, read by waiting: fieldMessageShows(page, <field>, 'Required', 10). The field
 * (its locator or its label; undefined = anywhere on the page) is left first, then the message in its own error / hint
 * area is waited for until it holds expected (spaces and a trailing dot ignored; '' = any message). Gives back that
 * message, else the last one seen ("" = none) - for an Expected / Actual check.
 */
export async function fieldMessageShows(page: Page, field: string | undefined, expected: string, seconds = 10): Promise<string> {
  await settle(page, Math.max(1, seconds) * 1000);
  const found = field?.trim() ? fieldOf(page, field.trim()) : undefined;
  if (found && (await found.count().catch(() => 0)) > 0) await found.evaluate(leave).catch(() => undefined);
  const want = clean(expected);
  const until = Date.now() + Math.max(1, seconds) * 1000;
  let last = '';
  for (;;) {
    last = await readNow(page, found);
    if (last && (!want || clean(last).includes(want))) return last;
    if (Date.now() >= until) return last;
    await page.waitForTimeout(LOOK_EVERY_MS);
  }
}
