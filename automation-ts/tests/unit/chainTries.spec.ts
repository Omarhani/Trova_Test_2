import { expect, test } from '@playwright/test';
import { chainTries, triesFrom } from '../../src/run/chainTries';
import type { SuiteBlock } from '../../src/run/suitePlan';

/** a proof run goes through the whole chain each try: make, use, delete - then again; the sign-in block once */

const block = (name: string, spec: string): SuiteBlock =>
  ({ name, params: {}, groups: [], tests: [{ spec, method: 'm' }] }) as unknown as SuiteBlock;
const signIn = block('Log in', 'tests/api/signIn/logIn.spec.ts');
const add = block('Add', 'tests/web/employees/EmployeesTests.spec.ts');
const edit = block('Edit', 'tests/web/employees/EmployeesTests.spec.ts');
const del = block('Delete', 'tests/api/employees/EmployeesTests.spec.ts');

test('three tries run the chain in order each time, the sign-in block only first', () => {
  expect(chainTries([signIn, add, edit, del], 3).map((b) => b.name))
    .toEqual(['Log in', 'Add', 'Edit', 'Delete', 'Add', 'Edit', 'Delete', 'Add', 'Edit', 'Delete']);
});

test('one try, or a count out of range, is the suite as it is', () => {
  expect(chainTries([signIn, add], 1).map((b) => b.name)).toEqual(['Log in', 'Add']);
  expect(chainTries([signIn, add], 50).map((b) => b.name)).toEqual(['Log in', 'Add']);
});

test('the try count comes from TROVA_REPEAT (2-5), else 1', () => {
  expect(triesFrom({ TROVA_REPEAT: '3' })).toBe(3);
  expect(triesFrom({ TROVA_REPEAT: 'x' })).toBe(1);
  expect(triesFrom({})).toBe(1);
});
