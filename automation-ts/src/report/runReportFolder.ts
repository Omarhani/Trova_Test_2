import * as fs from 'node:fs';
import * as path from 'node:path';
import { projectRoot } from '../run/runDataFile';
import { testData } from '../run/testData';

/** a title as a file name part: "Sign-up e-mail" -> "Sign-up_e-mail" */
export function fileNamePart(title: string): string {
  return title.replace(/[^\w-]+/g, '_').slice(0, 80);
}

/**
 * A file kept with the run: the runner uploads report/<testEnv|stageEnv>/run-<id>/ at the run's end (RunReport), so it
 * reaches Trova with the run. Nothing is written outside a Trova run (no TROVA_RUN_ID); false then.
 */
export function keepFileWithRun(name: string, body: Buffer | string): boolean {
  const runId = process.env.TROVA_RUN_ID?.trim();
  if (!runId) return false;
  const env = testData.env();
  const folder = path.join(projectRoot(), 'report', `${env.charAt(0).toLowerCase()}${env.slice(1)}Env`, `run-${runId}`);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, name), body);
  return true;
}

/** a failure's last screen kept with the run */
export function keepWithRun(title: string, png: Buffer): void {
  const name = `${fileNamePart(title)}-last-screen.png`;
  if (keepFileWithRun(name, png)) console.log(`Last screen kept with the run: report/${name}`);
}
