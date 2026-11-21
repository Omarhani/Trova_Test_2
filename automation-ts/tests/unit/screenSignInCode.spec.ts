import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { JsonObject } from '../../src/api/client/recipe/json';
import { screenSignIn } from '../../src/web/signin/screenSignIn';
import { CodeStep } from '../../src/web/signin/codeStep';
import { webShot } from '../../src/web/webPicture';

/**
 * The saved screen steps (user, password, sign-in button) ended on the app's
 * "enter the code" dialog - four one-digit boxes and a Send button - and the run waited 20 s and failed with "the app
 * showed its sign-in page". A code the steps never named is typed from the login's fixed code in Test Data and the
 * dialog's button pressed; the two steps are kept (healed) so the next runs do them by themselves.
 */
const WEB = 'http://app.test/';
const LOGIN = `<html><body><form onsubmit="return false">
<input name="user" placeholder="Username"><input type="password" name="pw">
<button id="go" type="button">Sign in</button></form>
<script>
document.getElementById('go').onclick = () => setTimeout(() => {
  const d = document.createElement('div'); d.setAttribute('role', 'dialog');
  d.innerHTML = '<p>Enter the verification code sent to your phone</p>'
    + [0, 1, 2, 3].map((i) => '<input maxlength="1" class="d" data-i="' + i + '">').join('')
    + '<button type="button" id="send">Send</button>';
  document.body.appendChild(d);
  const boxes = Array.from(d.querySelectorAll('input.d'));
  boxes.forEach((b, i) => b.addEventListener('input', () => { if (b.value && boxes[i + 1]) boxes[i + 1].focus(); }));
  document.getElementById('send').onclick = () => {
    if (boxes.map((b) => b.value).join('') !== '1234') return;
    location.hash = '#/dashboard';
    document.body.innerHTML = '<nav><a href="#/a">One</a><a href="#/b">Two</a><a href="#/c">Three</a></nav>';
  };
}, 300);
</script></body></html>`;
const RECIPE: JsonObject = {
  url: WEB,
  steps: [{ fill: 'input[name="user"]', field: 'Username' }, { fill: 'input[name="pw"]', field: 'Password' }, { click: '#go' }],
  done: '/dashboard',
};

let browser: Browser;
let page: Page;

test.beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
});

test.afterAll(async () => {
  await browser.close();
});

test.beforeEach(async () => { // review 993: each test its own page - nothing of an earlier test is left on it
  process.env.TROVA_WRITER_TRY = '1'; // a writer's own check run (the runner says so)
  page = await browser.newPage();
  await page.route(WEB, (r) => r.fulfill({ contentType: 'text/html', body: LOGIN }));
});
test.afterEach(async () => {
  delete process.env.TROVA_WRITER_TRY;
  await page.close();
});

const DIALOG = `<html><body><div role="dialog"><p>Enter the verification code</p>
${[0, 1, 2, 3].map(() => '<input maxlength="1" class="d">').join('')}<button type="button">Send</button></div>
<script>const b = Array.from(document.querySelectorAll('input.d'));
b.forEach((x, i) => x.addEventListener('input', () => { if (x.value && b[i + 1]) b[i + 1].focus(); }));</script></body></html>`;

test('review 993: a SUITE never types a code on the screen - it stops and says to sign in once in an AI session', async () => {
  delete process.env.TROVA_WRITER_TRY;
  await expect(screenSignIn(page, WEB, 'Manager', RECIPE, { Username: 'u', Password: 'p', OTP: '1234' }))
    .rejects.toThrow(/The saved sign-in steps stop at the app's code - sign in once in an AI session as Manager/);
});

test('review 993: the code step\'s picture is taken before the code is typed - no digit in any picture', async () => {
  await page.setContent(DIALOG);
  let seen: Promise<string> = Promise.resolve('not shown');
  const shown = () => { seen = page.evaluate(() => Array.from(document.querySelectorAll('input.d')).map((e) => (e as HTMLInputElement).value).join('')); };
  expect(await new CodeStep([], { OTP: '1234' }, 'Manager', true, shown).tryOnce(page)).toBe(true);
  expect(await seen).toBe('');
});

const SAVED = `<html><body><form onsubmit="return false"><input name="user"><input name="pin2">
<button id="go" type="button">Sign in</button></form>
<script>document.getElementById('go').onclick = () => { if (document.querySelector('[name=pin2]').value !== '1234') return;
  location.hash = '#/dashboard'; const n = document.createElement('nav');
  n.innerHTML = '<a href="#/a">One</a><a href="#/b">Two</a><a href="#/c">Three</a>'; document.body.appendChild(n); };</script></body></html>`;
const SAVED_RECIPE: JsonObject = { url: 'http://saved.test/', done: '/dashboard',
  steps: [{ fill: 'input[name="user"]', field: 'Username' }, { fill: 'input[name="pin2"]', field: 'OTP' }, { click: '#go' }] };

test('review 993: a SAVED code step hides its digits from the moment it types - in every picture and in the run\'s video', async () => {
  await page.route('http://saved.test/', (r) => r.fulfill({ contentType: 'text/html', body: SAVED }));
  await screenSignIn(page, 'http://saved.test/', 'Manager', SAVED_RECIPE, { Username: 'u', OTP: '1234' });
  const fill = await page.evaluate(() => getComputedStyle(document.querySelector('[name=pin2]') as Element).webkitTextFillColor);
  expect(fill).toBe('rgba(0, 0, 0, 0)'); // the video is the live screen: the digits were never drawn
  const typed = await webShot(page);
  await page.evaluate(() => { (document.querySelector('[name=pin2]') as HTMLInputElement).value = ''; });
  expect(typed.equals(await webShot(page))).toBe(true);
});

test('review 993: the code dialog\'s boxes are covered before the code is typed (the live video never shows it)', async () => {
  await page.setContent(DIALOG);
  let fills: Promise<string[]> = Promise.resolve([]);
  const shown = () => { fills = page.evaluate(() => Array.from(document.querySelectorAll('input.d')).map((e) => getComputedStyle(e).webkitTextFillColor)); };
  await new CodeStep([], { OTP: '1234' }, 'Manager', true, shown).tryOnce(page);
  expect(await fills).toEqual(Array(4).fill('rgba(0, 0, 0, 0)'));
});

test('a code dialog the saved steps never named is filled from the login\'s fixed code, and the steps are kept', async () => {
  const out = await screenSignIn(page, WEB, 'Manager', RECIPE, { Username: 'u', Password: 'p', OTP: '1234' });
  expect(page.url()).toContain('#/dashboard');
  const steps = (out.healed?.steps ?? []) as { fill?: string; field?: string; click?: string }[];
  expect(steps.some((s) => s.field === 'OTP' && !!s.fill)).toBe(true);
  expect(steps.some((s) => s.click === 'text=Send')).toBe(true);
});

test('a code dialog with no fixed code for the login says what to add, in plain words', async () => {
  await expect(screenSignIn(page, WEB, 'Manager', RECIPE, { Username: 'u', Password: 'p' }))
    .rejects.toThrow(/needs a one-time code.*Test Data/);
});
