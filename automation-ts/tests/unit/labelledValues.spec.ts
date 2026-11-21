import { expect, test } from '@playwright/test';
import { byColumn, byLabel } from '../../src/web/labelledValues';

test.use({ channel: 'chrome', headless: true });

/** A value on a details view or in a table is read by its label or column header, never by its place. */

const DETAILS = `
  <dl><dt>Date</dt><dd>2026-11-20</dd><dt>Hours:</dt><dd>3</dd></dl>
  <div><span>الحالة</span><span>معلق</span></div>
  <div class="row"><label for="code">Code</label><input id="code" value="A-77"></div>
  <p><b>Owner</b>: Sample Person</p>
  <div style="display:none"><span>Hidden</span><span>never</span></div>`;

const TABLE = `<table id="t"><thead><tr><th>Name</th><th>Hours</th></tr></thead>
  <tbody><tr><td>First row</td><td>1</td></tr><tr><td>Second row</td><td>8</td></tr></tbody></table>`;

test('the value next to a label, a trailing colon ignored', async ({ page }) => {
  await page.setContent(DETAILS);
  expect(await byLabel(page, 2, 'Hours')).toBe('3');
  expect(await byLabel(page, 2, 'date')).toBe('2026-11-20');
});

test('either language: the first label that is on the screen', async ({ page }) => {
  await page.setContent(DETAILS);
  expect(await byLabel(page, 2, 'Status', 'الحالة')).toBe('معلق');
});

test('a label tied to a field gives the field\'s value', async ({ page }) => {
  await page.setContent(DETAILS);
  expect(await byLabel(page, 2, 'Code')).toBe('A-77');
});

test('a label inside its line gives the rest of the line', async ({ page }) => {
  await page.setContent(DETAILS);
  expect(await byLabel(page, 2, 'Owner')).toBe('Sample Person');
});

test('a label not on the screen gives "" after the wait', async ({ page }) => {
  await page.setContent(DETAILS);
  expect(await byLabel(page, 1, 'Hidden')).toBe('');
  expect(await byLabel(page, 1, 'Nowhere')).toBe('');
});

test('a value that shows a moment later is waited for', async ({ page }) => {
  await page.setContent(`<div id="d"></div><script>setTimeout(() => {
    document.getElementById('d').innerHTML = '<span>Total</span><span>42</span>'; }, 400);</script>`);
  expect(await byLabel(page, 5, 'Total')).toBe('42');
});

test('a table cell under its column header in the row holding a text', async ({ page }) => {
  await page.setContent(TABLE);
  expect(await byColumn(page, '#t', 'Second row', 2, 'Hours')).toBe('8');
  expect(await byColumn(page, '#t', '', 2, 'hours')).toBe('1');
});

test('a column or row not in the table gives ""', async ({ page }) => {
  await page.setContent(TABLE);
  expect(await byColumn(page, '#t', 'Second row', 1, 'Rate')).toBe('');
  expect(await byColumn(page, '#t', 'Third row', 1, 'Hours')).toBe('');
});
