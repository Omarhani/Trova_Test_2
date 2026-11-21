/**
 * The test bases every case stands on - ready, never rewritten by a case: the run's one browser opened signed in by the
 * run's one sign-in (webTest), the run's phone session (phoneTest), the block's values (param),
 * the named checks and the records a set-up hands to its case. API cases and set-up / clean-up blocks use BaseApi.ts.
 */
export { webTest } from '../../src/web/webTest';
export { phoneTest } from '../../src/phone/phoneTest';
export { param } from '../../src/run/blockParams';
export { checkEquals, checkContains, checkTrue, checkFalse } from '../../src/report/checks';
export { runRecords } from '../../src/run/runRecords';
export { caseRecords } from '../../src/run/caseRecords';
export { testData } from '../../src/run/testData';
