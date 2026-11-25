import { Page } from '@playwright/test';
import { emit } from '../../report/liveEvents';
import { MASK, secretField } from '../../report/secretValues';
import { nextStep } from '../../report/stepNumbers';
import { stepPictures } from '../stepPictures';

type Say = (type: string, fields: Record<string, unknown>) => void;

/** "Password" (a secret) types *** - a typed value is never shown; any other field shows only its name */
export function typedWords(field: string): { e: string; v?: string } {
  const name = field.trim() || 'the box';
  return secretField(name) ? { e: name, v: MASK } : { e: name };
}

/**
 * So a run page never says "No steps were recorded" or "No pictures for this test" for a sign-in: every step of a
 * sign-in on the screen is a step of the run page with its picture, like any web step - "Open" the sign-in page,
 * "Type" each field (a secret as ***), "Click" each button, and where it stopped. Never a typed value.
 */
export function signInStepShown(page: Page, action: string, words: { e: string; v?: string }, say: Say = emit): void {
  const n = nextStep();
  say('step', { n, a: action, e: words.e, ...(words.v === undefined ? {} : { v: words.v }) });
  stepPictures.shoot(page, n);
}
