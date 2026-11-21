import { expect, test } from '@playwright/test';
import { kindOf } from '../../src/report/failureKind';

/**
 * A proof run: the timed-out Delete said "Test timeout of 300000ms exceeded while setting up "page"." and the refused
 * Add began with "Error:" - the run page shows plain words only, never the tool's words.
 */

test('a page that did not open in the case\'s time is a failure in plain words - it may be the app that never opened', () => {
  const k = kindOf('Test timeout of 300000ms exceeded while setting up "page".');
  expect(k.kind).toBe('failed'); // its set-up holds the sign-in and the app's page: never hidden as Trova's own problem
  expect(k.reason).toBe("The app's page did not open within 5 minutes");
});

test('a case that did not finish in its time says so in minutes, with no "ms" and no "Test timeout"', () => {
  const k = kindOf('Test timeout of 300000ms exceeded.');
  expect(k.kind).toBe('failed'); // as before: never tried again
  expect(k.reason).toBe('The case did not finish within 5 minutes');
});

test('a wrong value keeps its words without "Error:"', () => {
  const k = kindOf('Error: The toast after saving - expected "تمت اضافة الموظف بنجاح", seen "موجود مسبقا" ✗');
  expect(k.kind).toBe('failed');
  expect(k.reason).toBe('The toast after saving - expected "تمت اضافة الموظف بنجاح", seen "موجود مسبقا" ✗');
});

test('a step that waited too long stays a failure, as before', () => {
  expect(kindOf('TimeoutError: locator.click: Timeout 5000ms exceeded').kind).toBe('failed');
});
