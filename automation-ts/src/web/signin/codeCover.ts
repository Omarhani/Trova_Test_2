import { ElementHandle, Page } from '@playwright/test';
import { CODE_COVER, onPage } from './signInScripts';

const CHECK_MS = 2000;

/**
 * Review 993: no code digit on a picture. The boxes a run typed a code into ([data-trova-code], see keepCodesHidden) are
 * covered again right before the picture (an app may have redrawn their style) - no other box: a business value stays.
 * A page too busy to answer within 2 s is pictured as it is (its typed code boxes are covered since they were typed).
 */
export async function withCodesHidden<T>(page: Page, take: () => Promise<T>): Promise<T> {
  await within(onPage<number>(page, CODE_COVER, 'hide'), CHECK_MS);
  return take();
}

/**
 * Review 993: the run's video is the live screen, drawn all the time - so a box a code goes into is covered BEFORE the
 * code is typed, and stays covered (the box Trova types into, and the one-digit boxes beside it).
 */
export async function keepCodesHidden(page: Page, box: ElementHandle | null): Promise<void> {
  await box?.evaluate((e) => (e as Element).setAttribute('data-trova-code', '1')).catch(() => undefined);
  await onPage<number>(page, CODE_COVER, 'keep');
}

function within<T>(read: Promise<T>, ms: number): Promise<T | 'late'> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<'late'>((done) => { timer = setTimeout(() => done('late'), ms); });
  return Promise.race([read, late]).finally(() => clearTimeout(timer));
}
