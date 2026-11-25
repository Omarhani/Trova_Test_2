import type { TestCase } from '@playwright/test/reporter';
import { trapBlock } from './trapBlock';

/** one block of the run as it starts: its name, how many tests it has, and whether it is wrong on purpose (trap=true) */
export interface PlanBlock {
  name: string;
  tests: number;
  trap?: true;
}

/**
 * the run's blocks when it starts, so the platform knows its real cases from the first moment and its total never moves
 * - which blocks are cases is decided there; this only says what will run.
 */
export function planBlocks(tests: TestCase[]): PlanBlock[] {
  const byName = new Map<string, PlanBlock>();
  for (const test of tests) {
    const project = test.parent.project();
    const name = project?.name ?? '';
    const params = (project?.metadata as { params?: Record<string, string> } | undefined)?.params;
    const block = byName.get(name) ?? { name, tests: 0, ...(trapBlock(params) ? { trap: true as const } : {}) };
    block.tests++;
    byName.set(name, block);
  }
  return [...byName.values()];
}
