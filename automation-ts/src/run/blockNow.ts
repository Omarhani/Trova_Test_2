import type { BlockRole } from './caseGuard';

let role: BlockRole | undefined;

/** the role of the block running now in this process (the base test sets it) - read by the run's sign-in */
export const blockNow = {
  role: (): BlockRole | undefined => role,
  set: (r: BlockRole | undefined): void => { role = r; },
};
