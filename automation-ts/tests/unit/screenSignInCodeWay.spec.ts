import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { JsonObject } from '../../src/api/client/recipe/json';
import { screenSignIn } from '../../src/web/signin/screenSignIn';
import { CodeWay, wayWanted } from '../../src/web/signin/codeWay';
import { family } from '../../src/web/signin/signInPage';

/**
 * Bug 81: after the password the app asks HOW to send the one-time code (e-mail or text message, then its
 * "إرسال" send button) before the code box shows, and it signs in by itself once the 4th digit is typed - no confirm
 * click. The starter's screen sign-in went straight to the code box (found none) and, after the code, clicked the saved
 * "try another way" link. Now it picks the first way, presses send, types the code, and stops once the app is in (~3 s).
 * A saved click before the code (Microsoft "Sign in another way", a pop-up's Close) is still made.
 */
const WEB = 'http://way.test/';
const app = (choice: boolean, auto: boolean) => `<html><body><form onsubmit="return false">
<input name="user"><input type="password" name="pw"><button id="go" type="button">Sign in</button></form>
<script>
window.clicks = { another: 0, confirm: 0, sent: 0 };
const signIn = () => { location.hash = '#/dashboard';
  document.body.innerHTML = '<nav><a href="#/a">One</a><a href="#/b">Two</a><a href="#/c">Three</a></nav>'; };
const codeBox = () => { const d = document.createElement('div'); d.setAttribute('role', 'dialog');
  d.innerHTML = '<p>أدخل رمز التحقق</p>' + '<input class="d" autocomplete="one-time-code" maxlength="4">'
    + '<button type="button" id="ok">تأكيد</button><a href="#" id="another">تجربة طريقة أخرى</a>';
  document.body.appendChild(d);
  const box = d.querySelector('input.d');
  const code = () => box.value;
  box.addEventListener('input', () => { if (${auto} && code() === '1234') setTimeout(signIn, 400); });
  d.querySelector('#ok').onclick = () => { window.clicks.confirm++; if (code() === '1234') signIn(); };
  d.querySelector('#another').onclick = (e) => { e.preventDefault(); window.clicks.another++; }; };
const way = () => { document.querySelector('form').hidden = true; const d = document.createElement('div'); d.setAttribute('role', 'dialog');
  d.innerHTML = '<p>اختر طريقة إرسال رمز التحقق</p><label><input type="radio" name="w" value="mail"> البريد الإلكتروني</label>'
    + '<label><input type="radio" name="w" value="sms"> رسالة نصية</label><button type="button" id="send" disabled>إرسال</button>';
  document.body.appendChild(d);
  d.querySelectorAll('input[type=radio]').forEach((r) => r.addEventListener('change', () => { d.querySelector('#send').disabled = false; }));
  d.querySelector('#send').onclick = () => { window.clicks.sent++; d.remove(); setTimeout(codeBox, 300); }; };
document.getElementById('go').onclick = () => setTimeout(${choice} ? way : codeBox, 300);
</script></body></html>`;
const RECIPE = (confirm: string): JsonObject => ({ url: WEB, done: '/dashboard', steps: [
  { fill: 'input[name="user"]', field: 'Username' }, { fill: 'input[name="pw"]', field: 'Password' }, { click: '#go' },
  { fill: 'input.d', field: 'OTP' }, { click: confirm }] });
const VALUES = { Username: 'u', Password: 'p', OTP: '1234' };

let browser: Browser;
let page: Page;

test.beforeAll(async () => { browser = await chromium.launch({ channel: 'chrome', headless: true }); });
test.afterAll(async () => { await browser.close(); });
test.afterEach(async () => { await page.close(); });

async function open(choice: boolean, auto: boolean): Promise<void> {
  page = await browser.newPage();
  await page.route(WEB, (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: app(choice, auto) }));
}
const clicks = () => page.evaluate(() => (window as unknown as { clicks: Record<string, number> }).clicks);

test('red first (bug 81): the app asks how to send the code - the first way is picked, sent, the code typed and the app signs in by itself; "another way" is never clicked', async () => {
  await open(true, true);
  await screenSignIn(page, WEB, 'Account Manager', RECIPE('text=تجربة طريقة أخرى'), VALUES);
  expect(page.url()).toContain('#/dashboard');
  expect(await clicks()).toEqual({ another: 0, confirm: 0, sent: 1 });
});

test('red (bug 81): the app signs in by itself after the code - the steps stop there, the saved "another way" click is not made', async () => {
  await open(false, true);
  await screenSignIn(page, WEB, 'Account Manager', RECIPE('text=تجربة طريقة أخرى'), VALUES);
  expect(page.url()).toContain('#/dashboard');
  expect(await clicks()).toEqual({ another: 0, confirm: 0, sent: 0 });
});

test('golden: an app that needs a real confirm click after the code still gets it', async () => {
  await open(false, false);
  await screenSignIn(page, WEB, 'Manager', RECIPE('text=تأكيد'), VALUES);
  expect(page.url()).toContain('#/dashboard');
  expect(await clicks()).toEqual({ another: 0, confirm: 1, sent: 0 });
});

test('golden: the way dialog with no code step saved (writer try) - way sent once, the code typed from Test Data', async () => {
  process.env.TROVA_WRITER_TRY = '1';
  try {
    await open(true, true);
    const recipe = RECIPE('#none');
    (recipe.steps as JsonObject[]).splice(3);
    await screenSignIn(page, WEB, 'Manager', recipe, VALUES);
    expect(page.url()).toContain('#/dashboard');
    expect((await clicks()).sent).toBe(1);
  } finally {
    delete process.env.TROVA_WRITER_TRY;
  }
});

const OTHER = `<html><body><div id="pop" role="dialog"><p>We use cookies</p><button id="x" type="button">Close</button></div>
<input name="user"><a href="#" id="other">Sign in another way</a><div id="pwd" hidden><input type="password" name="pw">
<button id="go" type="button">Sign in</button></div>
<script>document.getElementById('x').onclick = () => document.getElementById('pop').remove();
document.getElementById('other').onclick = (e) => { e.preventDefault(); document.getElementById('pwd').hidden = false; };
document.getElementById('go').onclick = () => { if (document.getElementById('pop')) return; location.hash = '#/dashboard';
  document.body.innerHTML = '<nav><a href="#/a">One</a><a href="#/b">Two</a><a href="#/c">Three</a></nav>'; };</script></body></html>`;

test('golden: "close a pop-up first" and "sign in another way, then password" - both saved clicks are still made', async () => {
  page = await browser.newPage();
  await page.route('http://other.test/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: OTHER }));
  await screenSignIn(page, 'http://other.test/', 'Manager', { url: 'http://other.test/', done: '/dashboard', steps: [
    { click: 'text=Close' }, { fill: 'input[name="user"]', field: 'Username' }, { click: 'text=Sign in another way' },
    { fill: 'input[name="pw"]', field: 'Password' }, { click: '#go' }] }, VALUES);
  expect(page.url()).toContain('#/dashboard');
});

const COOKIE = `<html><body><div role="dialog"><p>We use cookies. Read our privacy terms, sent by e-mail.</p>
<label><input type="checkbox" id="agree"> I agree</label><button type="button" id="cont">Continue</button></div>
<script>window.pressed = 0; document.getElementById('cont').onclick = () => { window.pressed++; };</script></body></html>`;

test('trap (review 1012): a cookie dialog with an "I agree" box and Continue stays untouched - no consent is given', async () => {
  page = await browser.newPage();
  await page.setContent(COOKIE);
  expect(await new CodeWay(false, '').send(page)).toBe(false);
  expect(await new CodeWay(true, '').send(page)).toBe(false);
  expect(await page.evaluate(() => [(document.getElementById('agree') as HTMLInputElement).checked,
    (window as unknown as { pressed: number }).pressed])).toEqual([false, 0]);
});

const WAYS = `<html><body><div role="dialog"><p>اختر طريقة إرسال رمز التحقق</p>
<label><input type="radio" name="w" value="sms"> رسالة نصية</label><label><input type="radio" name="w" value="mail"> البريد الإلكتروني</label>
<button type="button">إرسال</button></div></body></html>`;
const picked = () => page.evaluate(() => (document.querySelector('input[name=w]:checked') as HTMLInputElement | null)?.value);

test('review 1012: the way named in Test Data is picked; none named = e-mail first', async () => {
  page = await browser.newPage();
  await page.setContent(WAYS);
  expect(await new CodeWay(true, '').send(page)).toBe(true);
  expect(await picked()).toBe('mail');
  await page.setContent(WAYS);
  expect(await new CodeWay(true, 'SMS').send(page)).toBe(true);
  expect(await picked()).toBe('sms');
});

test('review 1012: the way field of the login is read from Test Data by its name', () => {
  expect(wayWanted({ Username: 'u', OTP: '1234', 'Code way': 'sms' })).toBe('sms');
  expect(wayWanted({ Username: 'u', OTP: '1234' })).toBe('');
  expect(family('Code way')).toBe('other'); // never typed as the code
});

const PLAIN = `<html><body><input name="user"><button id="go" type="button">Sign in</button>
<script>window.clicks = { confirm: 0 };
document.getElementById('go').onclick = () => { history.pushState(null, '', '/step2');
  document.body.innerHTML = '<input name="c"><button type="button" id="ok">Confirm</button>';
  document.getElementById('ok').onclick = () => { window.clicks.confirm++; if (document.querySelector('[name=c]').value !== '1234') return;
    document.body.innerHTML = '<nav><a href="#/a">One</a><a href="#/b">Two</a><a href="#/c">Three</a></nav>'; }; };</script></body></html>`;

test('golden (review 1012): with no done sign the steps never stop while the code box is still there - Confirm is pressed', async () => {
  page = await browser.newPage();
  await page.route('http://plain.test/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: PLAIN }));
  await screenSignIn(page, 'http://plain.test/', 'Manager', { url: 'http://plain.test/', done: '', steps: [
    { fill: 'input[name="user"]', field: 'Username' }, { click: '#go' }, { fill: 'input[name="c"]', field: 'OTP' },
    { click: 'text=Confirm' }] }, VALUES);
  expect((await clicks()).confirm).toBe(1);
});
