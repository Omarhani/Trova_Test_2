import { expect, test } from '@playwright/test';
import { chainTries } from '../../src/run/chainTries';
import { roundParams } from '../../src/run/roundValues';
import type { SuiteBlock } from '../../src/run/suitePlan';

/**
 * A proof run: every round used the same user name and job number, so the second round's Add was refused
 * ("already exists") while round 1's employee was still there. Each round makes its own values now.
 */

const STAMP = '261546307013';
/** the runner's list: round 1's stamps, then each later round's own stamps in the same order (one stamp per round) */
const LISTED = `${STAMP}|261546307921|261546308377`;
const block = (name: string, params: Record<string, string>): SuiteBlock =>
  ({ name, params: { 'trova.stamps': LISTED, ...params }, groups: [], tests: [{ spec: 'tests/web/employee/EmployeeTests.spec.ts', method: 'm' }] });
const add = block('Add', { employee_user_name: `tc.add.emp+${STAMP}@example.test`, employee_job_number: `TCADD${STAMP}` });
const edit = block('Edit', { employee_user_name: `tc.add.emp+${STAMP}@example.test`, new_first_name: 'Trovaa' });

test('each round of a proof run makes its own user name and job number', () => {
  const rounds = chainTries([add, edit], 3);
  const names = rounds.filter((b) => b.name === 'Add').map((b) => b.params.employee_user_name);
  const numbers = rounds.filter((b) => b.name === 'Add').map((b) => b.params.employee_job_number);
  expect(names[0]).toBe(`tc.add.emp+${STAMP}@example.test`); // round 1 keeps the run's own value
  expect(new Set(names).size).toBe(3);
  expect(new Set(numbers).size).toBe(3);
  expect(names.every((n) => n.length === names[0].length)).toBe(true); // the same length: a number field still fits
});

test('the cases of one round share that round\'s values', () => {
  const rounds = chainTries([add, edit], 2);
  expect(rounds[2].params.employee_user_name).toBe(rounds[3].params.employee_user_name);
  expect(rounds[3].params.new_first_name).toBe('Trovaa'); // a value with no stamp stays as it is
});

test('a suite with no stamps runs the same values each round, as before', () => {
  const plain = { ...add, params: { employee_user_name: 'fixed@example.test' } };
  expect(chainTries([plain], 3).map((b) => b.params.employee_user_name)).toEqual(['fixed@example.test', 'fixed@example.test', 'fixed@example.test']);
});

test('each later round takes the runner\'s own stamp for it - never round 1\'s with one digit moved', () => {
  const rounds = chainTries([add], 3).map((b) => b.params.employee_job_number);
  expect(rounds).toEqual([`TCADD${STAMP}`, 'TCADD261546307921', 'TCADD261546308377']);
});

test('a runner that listed no stamp of a later round leaves that round\'s values as they are', () => {
  const old = { ...add, params: { ...add.params, 'trova.stamps': STAMP } };
  expect(roundParams(old.params, 2).employee_job_number).toBe(`TCADD${STAMP}`);
});
