import { expect, test } from '@playwright/test';
import { WebActions } from '../../src/web/webActions';

test.use({ channel: 'chrome', headless: true });

/**
 * After the delete the case searched again and counted 0 rows
 * while the list was still loading (its last screen shows the spinner) - the pass never saw the result. A count is taken
 * only once the list finished loading.
 */
class Rows extends WebActions {
  count(expected: number, seconds: number): Promise<number> {
    return this.countBecomes('tbody tr', expected, seconds);
  }
}

/** the table empties, a loading layer shows, and the search answer brings the row back after 1.5 s */
const SEARCHING = `
  <div class="ngx-spinner-overlay" style="position:fixed;inset:0;background:#0003"></div>
  <table><tbody></tbody></table>
  <script>
    setTimeout(() => {
      document.querySelector('tbody').innerHTML = '<tr><td>new.person+1001@example.com</td></tr>';
      document.querySelector('.ngx-spinner-overlay').remove();
    }, 1500);
  </script>`;

test('a count of 0 taken while the list is still loading does not pass', async ({ page }) => {
  await page.setContent(SEARCHING);
  expect(await new Rows(page).count(0, 5)).toBe(1);
});

test('an empty list after loading counts 0', async ({ page }) => {
  await page.setContent(SEARCHING.replace("'<tr><td>new.person+1001@example.com</td></tr>'", "''"));
  expect(await new Rows(page).count(0, 5)).toBe(0);
});

test('a list still loading when the time is up never reads as the expected count', async ({ page }) => {
  await page.setContent('<div class="ngx-spinner-overlay" style="position:fixed;inset:0"></div><table><tbody></tbody></table>');
  expect(await new Rows(page).count(0, 1)).toBe(-1);
});

/** an app page whose search answer takes 1.5 s, shown with a spinner Trova does not know */
async function slowSearch(page: import('@playwright/test').Page, row: string): Promise<void> {
  await page.route('http://app.test/**', async (route) => {
    if (route.request().url().endsWith('/api/search')) {
      await new Promise((r) => setTimeout(r, 1500));
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ rows: row ? [row] : [] }) });
    }
    return route.fulfill({ contentType: 'text/html', body: `<div class="app-own-busy">...</div><table><tbody></tbody></table>
      <script>fetch('/api/search').then((r) => r.json()).then((j) => {
        document.querySelector('tbody').innerHTML = j.rows.map((x) => '<tr><td>' + x + '</td></tr>').join('');
        document.querySelector('.app-own-busy').remove();
      });</script>` });
  });
}

test('a count of 0 read while the search is still on its way does not pass, whatever the spinner', async ({ page }) => {
  const rows = new Rows(page);
  await slowSearch(page, 'new.person+1001@example.com');
  await page.goto('http://app.test/requests');
  expect(await rows.count(0, 5)).toBe(1);
});

test('an empty answer of the search counts 0 once it came', async ({ page }) => {
  const rows = new Rows(page);
  await slowSearch(page, '');
  await page.goto('http://app.test/requests');
  expect(await rows.count(0, 5)).toBe(0);
});

test('a search answering after 12 s under a spinner never passes a mid-search 0', async ({ page }) => {
  test.setTimeout(60_000);
  const rows = new Rows(page);
  await page.route('http://app.test/**', async (route) => {
    if (route.request().url().endsWith('/api/search')) {
      await new Promise((r) => setTimeout(r, 12_000));
      return route.fulfill({ contentType: 'application/json', body: '{"rows":["new.person+1001@example.com"]}' });
    }
    return route.fulfill({ contentType: 'text/html', body: `<div class="ngx-spinner-overlay" style="position:fixed;inset:0"></div>
      <table><tbody></tbody></table><script>fetch('/api/search').then((r) => r.json()).then((j) => {
        document.querySelector('tbody').innerHTML = j.rows.map((x) => '<tr><td>' + x + '</td></tr>').join('');
        document.querySelector('.ngx-spinner-overlay').remove();
      });</script>` });
  });
  await page.goto('http://app.test/requests');
  expect(await rows.count(0, 15)).toBe(1);
});

test('a loading layer that never goes does not fail a list that is there', async ({ page }) => {
  await page.setContent('<div class="ngx-spinner-overlay" style="position:fixed;inset:0;pointer-events:none"></div><table><tbody><tr><td>a</td></tr></tbody></table>');
  expect(await new Rows(page).count(1, 8)).toBe(1);
});

test('a list with no loading layer is counted at once', async ({ page }) => {
  await page.setContent('<table><tbody><tr><td>a</td></tr></tbody></table>');
  const started = Date.now();
  expect(await new Rows(page).count(1, 5)).toBe(1);
  expect(Date.now() - started).toBeLessThan(2000);
});
