import { Page } from '@playwright/test';
import { signInStepShown, typedWords } from './signInStepShown';
import { codeAsked, dialogButton, family, findNow, pickBox } from './signInPage';
import { stepPictures } from '../stepPictures';
import { keepCodesHidden } from './codeCover';

type Step = { fill?: string; field?: string; click?: string; wait?: number };
type Shown = (page: Page, field: string) => Promise<void> | void;

/** review 993: a writer's own run (the runner says so) may finish a sign-in code on the screen; a suite never */
export function writerTry(): boolean {
  return process.env.TROVA_WRITER_TRY === '1';
}

/** the typing step and its picture, waited for: the picture is taken before the code goes in */
const showTyping: Shown = async (page, field) => {
  signInStepShown(page, 'type', typedWords(field));
  await stepPictures.done(page);
};

/**
 * The saved screen steps ended on the app's "enter the code" dialog (the AI had
 * typed the code with another tool, so its steps never named it) and the run waited 20 s, then failed. In a writer's
 * own run, when the app asks for its code and the steps have no code step, the login's fixed code from Test Data is
 * typed into the code box (one-digit boxes take it digit by digit) and the dialog's button pressed - once. Both are
 * added to the steps, so the next runs do them by themselves. A suite never does this (review 993): it stops and says
 * to sign in once in an AI session. The step's picture is taken before the code is typed. Never logs a value.
 */
export class CodeStep {
  private tried = false;

  constructor(private readonly steps: Step[], private readonly fields: Record<string, string>, private readonly login: string,
              private readonly learning: boolean = writerTry(), private readonly shown: Shown = showTyping) {}

  /** true when it typed the code now (the steps changed) */
  async tryOnce(page: Page): Promise<boolean> {
    if (this.tried || this.steps.some((s) => s.fill !== undefined && family(s.field) === 'otp')) return false;
    if (!(await codeAsked(page))) return false;
    this.tried = true;
    if (!this.learning) {
      throw new Error(`Signing in as "${this.login}" on the screen stopped: The saved sign-in steps stop at the app's code - sign in once in an AI session as ${this.login}`);
    }
    const field = this.codeField();
    const box = await pickBox(page, field);
    const el = box ? await findNow(page, box, 2000) : null;
    if (!box || !el) return false;
    await keepCodesHidden(page, el); // review 993: covered before typing - the live video never draws the code
    await el.click({ timeout: 5000 });
    await this.shown(page, field); // its picture before the code is in the boxes (review 993)
    await page.keyboard.type(this.fields[field], { delay: 60 });
    this.steps.push({ fill: box, field });
    const button = await pressed(page);
    if (button) this.steps.push({ click: `text=${button}` });
    return true;
  }

  /** the login's code field with a value; none = said plainly what to add */
  private codeField(): string {
    const hit = Object.entries(this.fields).find(([k, v]) => family(k) === 'otp' && v?.trim());
    if (hit) return hit[0];
    throw new Error(`Signing in as "${this.login}" needs a one-time code, and Trova has no fixed code for this login - add a fixed code in Test Data → Credentials, so Trova can sign in again by itself when the sign-in runs out`);
  }
}

/** the dialog's confirm button, pressed once it is there (3 s at most); its text or null */
async function pressed(page: Page): Promise<string | null> {
  for (const until = Date.now() + 3000; Date.now() < until; await page.waitForTimeout(200)) {
    const text = await dialogButton(page, true);
    if (text) return text;
  }
  return null;
}
