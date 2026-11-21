/**
 * The base of API cases and of every set-up / clean-up block: a report entry per test, the signed-in client of a login
 * (AppApi.signedInAs - the run's one sign-in, never a second one, never a password in code) and the clean-up of exactly
 * the records the run made, newest first, each read back gone.
 */
export { trovaTest as apiTest } from '../../src/run/trovaTest';
export { AppApi, ok } from '../../src/api/client/appApi';
export { cleanUpRun } from '../../src/records/cleanUpByIds';
