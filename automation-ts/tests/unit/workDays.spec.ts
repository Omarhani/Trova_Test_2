import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { WorkDays } from '../../src/run/workDays';

/**
 * The day a scenario works on (the workDate parameter): today, a pinned date, or "auto" - one day per run, the same day
 * for every block of that run, the next run the next day.
 */

const TODAY = '2026-11-20';

function folder(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'work-days-'));
}

function days(dir: string, run: string, env: NodeJS.ProcessEnv = {}): WorkDays {
  return new WorkDays(() => dir, env, () => TODAY, () => run);
}

test('today, and a suite option that was not given, are today', () => {
  const d = days(folder(), 'r1');
  expect(d.of('today')).toBe(TODAY);
  expect(d.of(' Today ')).toBe(TODAY);
  expect(d.of('${workDateForMySuite}')).toBe(TODAY);
  expect(d.of('')).toBe(TODAY);
});

test('a pinned date stays that date', () => {
  expect(days(folder(), 'r1').of('2026-07-17')).toBe('2026-07-17');
});

test('auto: the first run starts today and keeps the day in the project data folder', () => {
  const dir = folder();
  expect(days(dir, 'r1').of('auto')).toBe(TODAY);
  expect(fs.readFileSync(path.join(dir, 'workDate.txt'), 'utf8').trim()).toBe(TODAY);
});

test('auto: every block of one run gets the same day, even in its own process', () => {
  const dir = folder();
  expect(days(dir, 'r1').of('auto')).toBe(TODAY);
  expect(days(dir, 'r1').of('auto')).toBe(TODAY); // a new block: a new reader, the same run
  expect(fs.readFileSync(path.join(dir, 'workDate.txt'), 'utf8').trim()).toBe(TODAY);
});

test('auto: the next run moves on one day', () => {
  const dir = folder();
  days(dir, 'r1').of('auto');
  expect(days(dir, 'r2').of('auto')).toBe('2026-11-21');
  expect(days(dir, 'r3').of('auto')).toBe('2026-11-22');
});

test('auto with a seed starts from it, in its own file', () => {
  const dir = folder();
  expect(days(dir, 'r1').of('auto:1910-01-01')).toBe('1910-01-01');
  expect(days(dir, 'r2').of('AUTO:1910-01-01')).toBe('1910-01-02');
  expect(fs.existsSync(path.join(dir, 'workDate-1910-01-01.txt'))).toBe(true);
  expect(days(dir, 'r2').of('auto')).toBe(TODAY); // the plain auto day has its own file
});

test('the first auto day may be given by the computer (workDateSeed)', () => {
  expect(days(folder(), 'r1', { workDateSeed: '2030-01-05' }).of('auto')).toBe('2030-01-05');
});

test('a shared date folder (dateDir) keeps one counter for every computer', () => {
  const dir = folder();
  const shared = folder();
  days(dir, 'r1', { dateDir: shared }).of('auto');
  expect(fs.existsSync(path.join(shared, 'workDate.txt'))).toBe(true);
  expect(fs.existsSync(path.join(dir, 'workDate.txt'))).toBe(false);
});

test('a value that is no work day stops in plain words', () => {
  expect(() => days(folder(), 'r1').of('tomorrow')).toThrow('"tomorrow" is not a work day - use today, auto, auto:yyyy-MM-dd or a date like 2026-07-17');
});
