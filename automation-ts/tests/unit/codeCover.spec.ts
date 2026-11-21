import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { keepCodesHidden } from '../../src/web/signin/codeCover';
import { webShot } from '../../src/web/webPicture';

/**
 * Review 993: no code digit is ever on a picture or the run's video - but only the boxes the run typed a code into (and
 * the one-digit boxes beside them) are covered. A business box is never covered by the words around it ("Product code",
 * "Barcode"): its value is what proves a pass.
 */
const CODE = `<html><body><input name="user" value="ali"><div role="dialog"><p>Enter the verification code</p>
<input maxlength="1" value="4"><input maxlength="1" value="8"><button>Send</button></div></body></html>`;

const colours = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll('input'))
  .map((e) => getComputedStyle(e).webkitTextFillColor || getComputedStyle(e).color));
const HIDDEN = 'rgba(0, 0, 0, 0)';

let browser: Browser;
let page: Page;

test.beforeAll(async () => { browser = await chromium.launch({ channel: 'chrome', headless: true }); });
test.afterAll(async () => { await browser.close(); });
test.beforeEach(async () => { page = await browser.newPage(); });
test.afterEach(async () => { await page.close(); });

test('review 993: the box a code is typed into and the one-digit boxes beside it are covered; the user name box is not', async () => {
  await page.setContent(CODE);
  await keepCodesHidden(page, await page.$('div[role=dialog] input'));
  const now = await colours(page);
  expect(now[0]).not.toBe(HIDDEN);
  expect(now.slice(1)).toEqual([HIDDEN, HIDDEN]);
});

test('review 993: a step picture with a typed code looks the same as one with empty code boxes', async () => {
  await page.setContent(`<html><body><div role="dialog"><p>Enter the verification code</p>
    <input maxlength="1" style="font-size:160px;width:200px" value="8"></div></body></html>`);
  await keepCodesHidden(page, await page.$('input'));
  const typed = await webShot(page);
  await page.evaluate(() => { (document.querySelector('input') as HTMLInputElement).value = ''; });
  expect(typed.equals(await webShot(page))).toBe(true);
});

test('review 993 guard: a "Product code" form\'s picture keeps its value - nothing typed a code into it', async () => {
  await page.setContent(`<html><body><div role="dialog"><p>Product code</p>
    <input name="productCode" style="font-size:160px;width:400px" value="88"></div></body></html>`);
  const typed = await webShot(page);
  await page.evaluate(() => { (document.querySelector('input') as HTMLInputElement).value = ''; });
  expect(typed.equals(await webShot(page))).toBe(false);
  expect((await colours(page))[0]).not.toBe(HIDDEN);
});
