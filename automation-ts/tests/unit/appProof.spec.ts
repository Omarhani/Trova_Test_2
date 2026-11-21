import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { proofVerdict, proveSignedIn } from '../../src/web/signin/appProof';

/**
 * Every case proves it is signed in before any step counts: the app's own first call answers 2xx, none of its calls
 * the menu showed, the first call was refused,
 * the app answered 401 to the run's sign-in).
 */
const WEB = 'http://app.test/';
const MENU = '<nav><a href="#/a">One</a><a href="#/b">Two</a><a href="#/c">طلبات التسجيل</a></nav>';
const DROPS = `<html><body>${MENU}<script>
  setTimeout(() => fetch('/api/me').then((r) => { if (r.status === 401) { location.hash = '#/login';
    document.body.innerHTML = '<form><input name="user"><input type="password"></form>'; } }), 300);
</script></body></html>`;
const STAYS = `<html><body>${MENU}<script>setTimeout(() => fetch('/api/me'), 300);</script></body></html>`;
const SILENT = `<html><body>${MENU}</body></html>`;
const COVERED = `<html><body><div class="loading-overlay" style="position:fixed;inset:0">...</div>${MENU}<script>
  fetch('/api/me').then(() => document.querySelector('.loading-overlay').remove());
</script></body></html>`;
const MAPPED = `<html><body>${MENU}<script>fetch('/api/me');
  setInterval(() => fetch('https://maps.googleapis.com/maps/api/js/ViewportInfo'), 300);
</script></body></html>`;

// the app's own account lookup on opening answered in 3-7 s and held every block's open up to 5 s
const SLOW_LOOKUP = `<html><body>${MENU}<script>fetch('/api/me');
  fetch('/api/Account/GetAccountIdByCode', { method: 'POST' });
</script></body></html>`;

let browser: Browser;
let page: Page;

async function app(html: string, status = 200, waitMs = 800): Promise<void> {
  await page.unrouteAll();
  await page.route('http://app.test/api/me', async (r) => {
    await new Promise((w) => setTimeout(w, waitMs));
    await r.fulfill({ status, body: '{}' });
  });
  await page.route(WEB, (r) => r.fulfill({ contentType: 'text/html', body: html }));
  await page.route('https://maps.googleapis.com/**', (r) => r.fulfill({ status: 200, body: '{}' }));
}

test.beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage();
});

test.afterAll(async () => {
  await browser.close();
});

test.afterEach(async () => {
  await page.goto('about:blank'); // a call still open is cut here, never inside the next test's proof
});

test('an app whose first call answers 401 and goes to its sign-in page is refused, with the status', async () => {
  await app(DROPS, 401);
  expect(await proveSignedIn(page, WEB)).toBe('its calls answered 401');
});

test('an app whose first call answers 403 is refused', async () => {
  await app(STAYS, 403);
  expect(await proveSignedIn(page, WEB)).toBe('its calls answered 403');
});

test('an app that stays signed in and whose first call answers 200 is proved, without a long wait', async () => {
  await app(STAYS);
  const start = Date.now();
  expect(await proveSignedIn(page, WEB)).toBeNull();
  expect(Date.now() - start).toBeLessThan(4000);
});

test('an app busy with its first calls is watched while it loads - no second wait after it settled', async () => {
  await app(COVERED, 200, 1500);
  const start = Date.now();
  expect(await proveSignedIn(page, WEB)).toBeNull();
  expect(Date.now() - start).toBeLessThan(2900);
});

test('a page whose map keeps calling Google is done once the app\'s own calls are quiet', async () => {
  await app(MAPPED);
  const start = Date.now();
  expect(await proveSignedIn(page, WEB)).toBeNull();
  expect(Date.now() - start).toBeLessThan(2900);
});

/** the account lookup answers only after 6 s (or never, when the next open cuts it) */
async function slowLookup(): Promise<void> {
  await page.route('http://app.test/api/Account/GetAccountIdByCode', async (r) => {
    await new Promise((w) => setTimeout(w, 6000));
    await r.fulfill({ status: 200, body: '{}' }).catch(() => undefined);
  });
}

test('an own call that stays open does not hold a proved open to the 5 s limit', async () => {
  await app(SLOW_LOOKUP);
  await slowLookup();
  const start = Date.now();
  expect(await proveSignedIn(page, WEB)).toBeNull();
  expect(Date.now() - start).toBeLessThan(2900);
});

test('a call that answers 401 while another stays open is still refused', async () => {
  await app(SLOW_LOOKUP, 401, 1200);
  await slowLookup();
  expect(await proveSignedIn(page, WEB)).toBe('its calls answered 401');
});

/**
 * Proof run #1287 (writer session #356): the kept sign-in was put in and "proved" - the app's first own call (its
 * account lookup) answered 200 after the watch had ended, and only then did the app go to its sign-in page. Every case
 * of the run was then blocked with "Actual: the sign-in page". The page after that late first answer counts too.
 */
const LATE_SIGN_OUT = `<html><body>${MENU}<script>
  fetch('/api/Account/GetAccountIdByCode', { method: 'POST' }).then(() => setTimeout(() => { location.hash = '#/login';
    document.body.innerHTML = '<form><input name="code"><button>Next</button></form>'; }, 300));
</script></body></html>`;

test('#1287: the app goes to its sign-in page right after its late first answer - not signed in', async () => {
  await app(LATE_SIGN_OUT);
  await page.route('http://app.test/api/Account/GetAccountIdByCode', async (r) => {
    await new Promise((w) => setTimeout(w, 2200));
    await r.fulfill({ status: 200, body: '{}' }).catch(() => undefined);
  });
  expect(await proveSignedIn(page, WEB)).toBe('it went to its sign-in page');
});

test('guard: an app whose late first answer keeps it signed in is still proved', async () => {
  await app(`<html><body>${MENU}<script>fetch('/api/Account/GetAccountIdByCode', { method: 'POST' });</script></body></html>`);
  await page.route('http://app.test/api/Account/GetAccountIdByCode', async (r) => {
    await new Promise((w) => setTimeout(w, 2200));
    await r.fulfill({ status: 200, body: '{}' }).catch(() => undefined);
  });
  expect(await proveSignedIn(page, WEB)).toBeNull();
});

test('an app that makes no call of its own is not taken as signed in', async () => {
  await app(SILENT);
  expect(await proveSignedIn(page, WEB, { firstMs: 500 })).toBe('it made no call of its own, so Trova could not see it signed in');
});

test('the verdict: a sign-in page, a refused call, a failed first call, or proved', () => {
  expect(proofVerdict({ url: 'http://app.test/#/login', held: true, statuses: [200] })).toBe('it went to its sign-in page');
  expect(proofVerdict({ url: 'http://app.test/', held: false, statuses: [200] })).toBe('it went to its sign-in page');
  expect(proofVerdict({ url: 'http://app.test/', held: true, statuses: [200, 401] })).toBe('its calls answered 401');
  expect(proofVerdict({ url: 'http://app.test/', held: true, statuses: [500] })).toBe('its first call answered 500');
  expect(proofVerdict({ url: 'http://app.test/', held: true, statuses: [0] })).toBe('its first call got no answer');
  expect(proofVerdict({ url: 'http://app.test/', held: true, statuses: [204, 404] })).toBeNull();
});
