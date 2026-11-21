import { expect, test } from '@playwright/test';
import { fieldMessageShows } from '../../src/web/fieldMessages';
import { WebActions } from '../../src/web/webActions';

test.use({ channel: 'chrome', headless: true });

/**
 * An expected error / validation message is read by waiting: the field is left first (many forms show it only then), then
 * the message in the field's own error / hint area, else any shown validation text on the page.
 */

const TWO_FIELDS = `
  <div class="mat-form-field"><input id="min"><div class="slot"></div></div>
  <div class="mat-form-field"><input id="max"><mat-error>Required</mat-error></div>
  <script>
    document.getElementById('min').addEventListener('blur', () => setTimeout(() => {
      document.querySelector('.slot').innerHTML = '<mat-error>Minimum must not be above the maximum.</mat-error>';
    }, 300));
  </script>`;

test('the message under the field shows after it is left, and is waited for', async ({ page }) => {
  await page.setContent(TWO_FIELDS);
  await page.focus('#min');
  expect(await fieldMessageShows(page, '#min', 'Minimum must not be above the maximum', 5)).toBe('Minimum must not be above the maximum.');
});

test('the field\'s own message is read, not the one of the field next to it', async ({ page }) => {
  await page.setContent(TWO_FIELDS);
  expect(await fieldMessageShows(page, 'css=#max', '', 2)).toBe('Required');
});

test('a message the field names (aria-describedby) is read first', async ({ page }) => {
  await page.setContent('<input id="e" aria-describedby="hint"><small id="hint">Use a work e-mail</small><div role="alert">Other</div>');
  expect(await fieldMessageShows(page, '#e', 'Use a work e-mail', 2)).toBe('Use a work e-mail');
});

test('the field may be named by its label', async ({ page }) => {
  await page.setContent('<div class="row"><label for="h">Hours</label><input id="h"><span class="text-danger">Too many hours</span></div>');
  expect(await fieldMessageShows(page, 'Hours', 'Too many hours', 2)).toBe('Too many hours');
});

test('it waits until the message reads what is expected', async ({ page }) => {
  await page.setContent(`<div><input id="a"><div class="invalid-feedback">Checking</div></div>
    <script>setTimeout(() => { document.querySelector('.invalid-feedback').textContent = 'Name is taken ×'; }, 400);</script>`);
  expect(await fieldMessageShows(page, '#a', 'Name is taken', 5)).toBe('Name is taken');
});

test('with no field, any shown validation text on the page', async ({ page }) => {
  await page.setContent('<form><span class="field-error">Fix the errors below</span><span class="field-error" style="display:none">hidden</span></form>');
  expect(await fieldMessageShows(page, undefined, '', 2)).toBe('Fix the errors below');
});

test('no message within the time gives "" for the Expected / Actual check', async ({ page }) => {
  await page.setContent('<div><input id="a"></div>');
  expect(await fieldMessageShows(page, '#a', 'Required', 1)).toBe('');
});

test('a different message is given back as it is, for the check to show', async ({ page }) => {
  await page.setContent('<div><input id="a"><mat-error>Must be a number</mat-error></div>');
  expect(await fieldMessageShows(page, '#a', 'Required', 1)).toBe('Must be a number');
});

class FormPage extends WebActions {
  minimumMessage(expected: string): Promise<string> {
    return this.fieldMessageShows('#a', expected, 2);
  }
}

test('a page object reads it with its own fieldMessageShows', async ({ page }) => {
  await page.setContent('<div><input id="a"><mat-error>Required.</mat-error></div>');
  expect(await new FormPage(page).minimumMessage('Required')).toBe('Required.');
});
