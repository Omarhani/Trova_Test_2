import * as fs from 'node:fs';
import * as path from 'node:path';
import { asObject, byName, projectRoot, section } from '../../run/runDataFile';
import { testData } from '../../run/testData';
import { emit } from '../../report/liveEvents';
import { nextStep } from '../../report/stepNumbers';
import { CodeWindow } from './codeWindow';
import { keepCodeWait } from './keptSignIn';

/** what Trova keeps for the login (Test Data → Credentials "Wait between sign-in codes", the last code request) */
function kept(login: string): { waitSeconds?: unknown; lastAskedAt?: unknown } {
  try {
    return asObject(byName(section('signInCodeWait'), login));
  } catch {
    return {};
  }
}

/** this computer's own record of the last code request (a run a moment ago, before Trova had it) - a time only */
function fileOf(login: string): string {
  const name = `${testData.env()}-${login.trim().toLowerCase()}`.replace(/[^A-Za-z0-9._-]/g, '_');
  return path.join(projectRoot(), 'target', 'sign-in-codes', `${name}.json`);
}

function localAsked(login: string): number | undefined {
  try {
    const at = Number((JSON.parse(fs.readFileSync(fileOf(login), 'utf8')) as { at?: unknown }).at);
    return Number.isFinite(at) && at > 0 ? at : undefined;
  } catch {
    return undefined;
  }
}

/** the latest code request of the login: Trova's (any run, any computer) or this computer's */
function lastAsked(login: string): number | undefined {
  const all = [Number(kept(login).lastAskedAt), localAsked(login)].filter((t): t is number => Number.isFinite(t) && (t as number) > 0);
  return all.length ? Math.max(...all) : undefined;
}

function asked(login: string, at: number): void {
  try {
    const file = fileOf(login);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ at }), 'utf8');
  } catch {
    // not kept here: Trova still gets it
  }
  keepCodeWait(login, { askedAt: at });
}

/** the login's wait in ms; undefined = empty (no wait) */
function windowMs(login: string): number | undefined {
  const s = Number(kept(login).waitSeconds);
  return Number.isFinite(s) && s > 0 ? s * 1000 : undefined;
}

/** the wait as a step of the run page ("Wait" · "Waiting 2 minutes - ...") and a line of the run */
function say(line: string): void {
  console.log(line);
  emit('step', { n: nextStep(), a: 'Wait', e: line });
}

/** the run's one-time-code wait: the real clock, Trova's and this computer's record, the login's own setting */
export const codeWindow = new CodeWindow({
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  say,
  lastAsked,
  asked,
  windowMs,
  learn: (login, ms) => keepCodeWait(login, { learnedSeconds: Math.round(ms / 1000) }),
});
