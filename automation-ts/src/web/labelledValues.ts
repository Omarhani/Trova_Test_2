import { Page } from '@playwright/test';
import { locate } from './anyOf';
import { settle } from './covers';

const LOOK_EVERY_MS = 250;
/** the least time the page gets to finish loading first */
const LOAD_SECONDS = 5;

/** in the page: the value next to the first shown label whose text is one of want ("" when none) */
function readByLabel(want: string[]): string {
  const wanted = want.map((w) => w.trim().toLowerCase());
  const txt = (e: Element): string => ((e as HTMLElement).innerText || e.textContent || '').replace(/\s+/g, ' ').trim();
  const shown = (e: Element | null): e is Element => !!e && e.getClientRects().length > 0;
  const labelText = (e: Element): string => txt(e).replace(/[:：]\s*$/, '').toLowerCase();
  for (const e of Array.from(document.querySelectorAll('label, dt, th, span, div, p, strong, b, td'))) {
    if (!wanted.includes(labelText(e)) || !shown(e)) continue;
    if (Array.from(e.children).some((c) => labelText(c) === labelText(e))) continue; // its inner element is the label
    const forId = e.getAttribute('for');
    const field = forId ? document.getElementById(forId) : null;
    if (field) return (field as HTMLInputElement).value || txt(field);
    const next = e.nextElementSibling;
    if (shown(next) && txt(next)) return txt(next);
    const box = e.parentElement;
    if (!box || box === document.body) continue;
    const rest = txt(box).replace(txt(e), '').replace(/^[:：\s]+/, '').trim();
    if (rest) return rest; // "<p><b>Owner</b>: Sample Person</p>"
    const after = box.nextElementSibling; // the label alone in its box, the value in the next one
    if (shown(after) && txt(after)) return txt(after);
  }
  return '';
}

/** in the table: the cell under the first header whose text is one of want, in the first row holding row ("" = any) */
function readByColumn(table: Element, [want, row]: [string[], string]): string {
  const wanted = want.map((w) => w.trim().toLowerCase());
  const txt = (e: Element): string => ((e as HTMLElement).innerText || e.textContent || '').replace(/\s+/g, ' ').trim();
  const heads = Array.from(table.querySelectorAll('thead th, [role=columnheader]'));
  const col = heads.findIndex((h) => wanted.includes(txt(h).toLowerCase()));
  if (col < 0) return '';
  for (const r of Array.from(table.querySelectorAll('tbody tr, [role=row]'))) {
    const cells = r.querySelectorAll('td, [role=cell], [role=gridcell]');
    if (!cells.length || (row && !txt(r).toLowerCase().includes(row.toLowerCase()))) continue;
    return cells[col] ? txt(cells[col]) : '';
  }
  return '';
}

/** reads until a value shows (the page finished loading first), at most seconds; "" when none came */
async function waitedRead(page: Page, seconds: number, read: () => Promise<string>): Promise<string> {
  await settle(page, Math.max(seconds, LOAD_SECONDS) * 1000);
  const until = Date.now() + Math.max(1, seconds) * 1000;
  for (;;) {
    const value = (await read().catch(() => '')).trim();
    if (value || Date.now() >= until) return value;
    await page.waitForTimeout(LOOK_EVERY_MS);
  }
}

/**
 * The value shown next to a label on a details view - read by its label, never by its place:
 * byLabel(page, 10, 'Hours', 'الساعات'). Any of the labels (either language); waits up to seconds; "" when the label is
 * not on the screen, so the check fails with Expected / Actual.
 */
export function byLabel(page: Page, seconds: number, ...labels: string[]): Promise<string> {
  return waitedRead(page, seconds, () => page.evaluate(readByLabel, labels));
}

/**
 * The cell under a column header (any of headers) in the first row of the table that holds rowText ("" = the first
 * row): byColumn(page, '#requests', 'Annual leave', 10, 'Status', 'الحالة'). "" when not found within seconds.
 */
export function byColumn(page: Page, table: string, rowText: string, seconds: number, ...headers: string[]): Promise<string> {
  return waitedRead(page, seconds, () => locate(page, table).first()
    .evaluate(readByColumn, [headers, rowText] as [string[], string], { timeout: 1000 }));
}
