import * as fs from 'node:fs';
import * as path from 'node:path';
import { param } from './blockParams';
import { projectRoot } from './runDataFile';
import { RUN_STAMP } from './runStamp';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEEDED = /^auto:(\d{4}-\d{2}-\d{2})$/i;
const LOCK_WAIT_MS = 5_000;
const STALE_LOCK_MS = 30_000;

const pad = (n: number): string => String(n).padStart(2, '0');

/** this computer's date today, yyyy-MM-dd */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nextDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

function readText(file: string): string {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
}

function pauseSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** runs work while holding the file's lock, so two runs at the same moment still get different days */
function locked<T>(file: string, work: () => T): T {
  const lock = `${file}.lock`;
  const until = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      fs.closeSync(fs.openSync(lock, 'wx'));
      break;
    } catch {
      const age = fs.existsSync(lock) ? Date.now() - fs.statSync(lock).mtimeMs : 0;
      if (age > STALE_LOCK_MS || Date.now() > until) { fs.rmSync(lock, { force: true }); continue; }
      pauseSync(50);
    }
  }
  try {
    return work();
  } finally {
    fs.rmSync(lock, { force: true });
  }
}

/**
 * The day a scenario works on - for apps whose data is per day (bookings, timesheets, schedules) that refuse the same
 * action twice on one day. From the suite's workDate parameter:
 *   today (or empty, or a ${workDateFor...} option not given)  this computer's date
 *   auto            the run's own day, one day on per run (data/workDate.txt; the first run starts at workDateSeed or
 *                   today) - every block of the run gets the same day, the next run the next day
 *   auto:yyyy-MM-dd the same, starting from that day, in its own file (data/workDate-<day>.txt)
 *   yyyy-MM-dd      that day, pinned
 * dateDir (on the computer) keeps the files in one shared folder for every computer of a pipeline.
 */
export class WorkDays {
  private readonly cache = new Map<string, string>();

  constructor(private readonly dataDir: () => string = () => path.join(projectRoot(), 'data'),
              private readonly env: NodeJS.ProcessEnv = process.env,
              private readonly today: () => string = localToday,
              private readonly runKey: () => string = () => process.env.TROVA_RUN_ID?.trim() || RUN_STAMP) {}

  of(value: string | undefined): string {
    const v = (value ?? '').trim();
    if (!v || /^today$/i.test(v) || /^\$\{workDateFor\w*}$/.test(v)) return this.today();
    if (/^auto$/i.test(v)) return this.rolled('workDate.txt', this.seed());
    const seeded = SEEDED.exec(v);
    if (seeded) return this.rolled(`workDate-${seeded[1]}.txt`, seeded[1]);
    if (DATE.test(v)) return v;
    throw new Error(`"${v}" is not a work day - use today, auto, auto:yyyy-MM-dd or a date like 2026-07-17`);
  }

  private seed(): string {
    const given = this.env.workDateSeed?.trim() ?? '';
    return DATE.test(given) ? given : this.today();
  }

  /** the run's day of that file: rolled once per run (its .run note says which run rolled it), then the same day */
  private rolled(name: string, seed: string): string {
    const key = this.runKey();
    const cached = this.cache.get(name);
    if (cached) return cached;
    const local = path.join(this.dataDir(), name);
    const shared = this.env.dateDir?.trim();
    const file = shared && !shared.startsWith('${') ? path.join(shared, name) : local;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const day = locked(file, () => {
      const [rolledBy, rolledDay] = readText(`${file}.run`).split(' ');
      if (rolledBy === key && rolledDay && DATE.test(rolledDay)) return rolledDay;
      const last = readText(file) || (file !== local ? readText(local) : '');
      const next = DATE.test(last) ? nextDay(last) : seed;
      fs.writeFileSync(file, next);
      fs.writeFileSync(`${file}.run`, `${key} ${next}`);
      return next;
    });
    console.log(`Work date (this run): ${day}`);
    this.cache.set(name, day);
    return day;
  }
}

export const workDays = new WorkDays();

/** the day this block works on: its workDate parameter (else fallback) - one day for every block of the run */
export function workDate(fallback = 'today'): string {
  return workDays.of(param('workDate', fallback));
}
