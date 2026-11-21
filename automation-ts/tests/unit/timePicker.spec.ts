import { expect, test } from '@playwright/test';
import { setTime } from '../../src/web/timePicker';

test.use({ channel: 'chrome', headless: true });

/** A time field is set in one call: typed when it takes typing, else through its clock dialog, then read back. */

/** a clock dialog like the common UI kits': "12 : 00" header, AM / PM, a round face (numbers 108 px out), Cancel / OK */
const CLOCK = `<input id="start" readonly mattimepicker style="margin:40px">
<script>
const pad = (n) => String(n).padStart(2, '0');
document.getElementById('start').onclick = () => {
  const d = document.createElement('div');
  d.setAttribute('role', 'dialog');
  d.innerHTML = '<div class="time-frame"><span class="time" id="h">12</span>:<span class="time" id="m">00</span></div>'
    + '<div class="ampm"><span id="am">AM</span> <span id="pm">PM</span></div>'
    + '<mat-clock style="display:block;position:relative;width:256px;height:256px;border-radius:50%;background:#eee">'
    + '<button class="number" style="position:absolute;left:116px;top:8px;width:24px;height:24px;padding:0">12</button></mat-clock>'
    + '<div class="actions"><button id="cancel">Cancel</button><button id="ok">OK</button></div>';
  document.body.appendChild(d);
  let mode = 'h', half = 'am';
  d.querySelector('#h').onclick = () => { mode = 'h'; };
  d.querySelector('#m').onclick = () => { mode = 'm'; };
  d.querySelector('#am').onclick = () => { half = 'am'; };
  d.querySelector('#pm').onclick = () => { half = 'pm'; };
  d.querySelector('mat-clock').onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    let a = Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2)));
    if (a < 0) a += 2 * Math.PI;
    if (mode === 'h') { d.querySelector('#h').textContent = pad(Math.round(a / (2 * Math.PI) * 12) % 12 || 12); mode = 'm'; }
    else d.querySelector('#m').textContent = pad(Math.round(a / (2 * Math.PI) * 60) % 60);
  };
  d.querySelector('#cancel').onclick = () => d.remove();
  d.querySelector('#ok').onclick = () => {
    document.getElementById('start').value = Number(d.querySelector('#h').textContent) + ':' + d.querySelector('#m').textContent + ' ' + half;
    d.remove();
  };
};
</script>`;

test('a read-only field gets its time through the clock dialog and shows it', async ({ page }) => {
  await page.setContent(CLOCK);
  expect(await setTime(page, '#start', '18:30', 5, 'Shift start')).toBe('6:30 pm');
  await expect(page.locator('[role=dialog]')).toHaveCount(0);
});

test('a morning time through the same clock', async ({ page }) => {
  await page.setContent(CLOCK);
  expect(await setTime(page, '#start', '9:15 am', 5)).toBe('9:15 am');
});

test('a field that takes typing gets the time typed', async ({ page }) => {
  await page.setContent('<input id="t">');
  expect(await setTime(page, '#t', '18:00', 3)).toBe('18:00');
});

test('a native time box gets HH:mm', async ({ page }) => {
  await page.setContent('<input id="t" type="time">');
  expect(await setTime(page, '#t', '6:05 pm', 3)).toBe('18:05');
});

test('a field not on the screen fails in plain words with its name', async ({ page }) => {
  await page.setContent('<p>nothing here</p>');
  await expect(setTime(page, '#start', '18:00', 1, 'Shift start')).rejects.toThrow('The Shift start field was not on the screen within 1 s');
});

test('a wrong time fails before anything is touched', async ({ page }) => {
  await page.setContent('<input id="t">');
  await expect(setTime(page, '#t', '25:00', 1)).rejects.toThrow('"25:00" is not a time - write it like 18:00 or 6:00 pm');
  expect(await page.inputValue('#t')).toBe('');
});

test('a field that does not keep the time fails with what it shows', async ({ page }) => {
  await page.setContent('<input id="t" oninput="this.value=\'\'">');
  await expect(setTime(page, '#t', '18:00', 1, 'End')).rejects.toThrow('The End field shows "" after choosing 6:00 pm');
});
