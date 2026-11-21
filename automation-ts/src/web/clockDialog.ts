import { Locator, Page } from '@playwright/test';
import { ClockTime } from './clockTime';

/** the clock dialog on top: Angular Material style (mat-clock / a time-frame header) */
export const DIALOG = "xpath=(//*[self::mat-dialog-container or @role='dialog'][.//mat-clock or .//*[contains(@class,'time-frame')]])[last()]";
const HEADER = '.time-frame span.time, .time-frame .time';
const HALVES = '.ampm span, .ampm button, .ampm div';
const FACE = 'mat-clock .circle, .clock-face, mat-clock';
const NUMBERS = 'mat-clock button.number, button.number';
const ACTIONS = 'mat-dialog-actions button, .mat-dialog-actions button, .actions button';
const OK_WORDS = ['ok', 'save', 'set', 'done', 'حفظ', 'موافق', 'تم'];
/** how far the numbers sit from the face's centre when they cannot be measured */
const FALLBACK_RADIUS = 108;
const TRIES = 3;

/**
 * The open clock dialog of a time field, worked the one known way: AM / PM first, then the hour in the header and its
 * place on the face, then the minute - each checked in the header and tried again (at most 3) - then OK.
 */
export class ClockDialog {
  private readonly dialog: Locator;

  constructor(private readonly page: Page, private readonly what: string) {
    this.dialog = page.locator(DIALOG);
  }

  async choose(want: ClockTime, seconds: number): Promise<void> {
    const twelve = await this.half(want);
    const hour = twelve ? want.hour12 : want.hour24;
    await this.face(0, hour % 12 === 0 ? 12 : hour % 12, 12, !twelve && want.innerRing24,
      twelve ? want.hourHeader : String(want.hour24).padStart(2, '0'), `${this.what}'s clock hour`);
    await this.face(1, want.minute, 60, false, want.minuteHeader, `${this.what}'s clock minute`);
    await this.ok(seconds);
  }

  /** clicks AM / PM when the clock has them; false = a 24-hour clock */
  private async half(want: ClockTime): Promise<boolean> {
    const halves = this.dialog.locator(HALVES);
    const texts = (await halves.allInnerTexts()).map((t) => t.trim().toLowerCase());
    const at = texts.findIndex((t) => (want.pm ? t === 'pm' || t === 'م' : t === 'am' || t === 'ص'));
    if (at >= 0) await halves.nth(at).click({ timeout: 5000 });
    return at >= 0 || texts.some((t) => t !== '');
  }

  /** header part (0 hour, 1 minute) chosen, then value out of full clicked on the face, until the header shows it */
  private async face(part: number, value: number, full: number, inner: boolean, header: string, what: string): Promise<void> {
    for (let attempt = 1; attempt <= TRIES; attempt++) {
      const heads = this.dialog.locator(HEADER);
      if ((await heads.count()) > part) await heads.nth(part).click({ timeout: 5000 });
      const face = this.dialog.locator(FACE).filter({ visible: true }).first();
      const box = await face.boundingBox({ timeout: 5000 }).catch(() => null);
      if (!box) throw new Error(`${what}: the clock face did not show`);
      const [x, y] = ClockTime.offset(value, full, (await this.radius(box)) * (inner ? 0.62 : 1));
      await this.page.mouse.click(box.x + box.width / 2 + x, box.y + box.height / 2 + y);
      if (await this.headerShows(part, header)) return;
    }
    throw new Error(`${what} did not show ${header} after ${TRIES} tries`);
  }

  private async headerShows(part: number, header: string): Promise<boolean> {
    const until = Date.now() + 3000;
    do {
      const texts = await this.dialog.locator(HEADER).allInnerTexts().catch(() => [] as string[]);
      if ((texts[part] ?? '').trim() === header) return true;
      await this.page.waitForTimeout(150);
    } while (Date.now() < until);
    return false;
  }

  /** measured on the face's "12" / "00", else the known size (the face re-draws between hours and minutes) */
  private async radius(face: { x: number; y: number; width: number; height: number }): Promise<number> {
    const numbers = this.dialog.locator(NUMBERS);
    for (let i = 0; i < (await numbers.count().catch(() => 0)); i++) {
      const n = numbers.nth(i);
      const text = (await n.innerText().catch(() => '')).trim();
      if (text !== '12' && text !== '00') continue;
      const box = await n.boundingBox().catch(() => null);
      if (!box) continue;
      const r = Math.hypot(box.x + box.width / 2 - (face.x + face.width / 2), box.y + box.height / 2 - (face.y + face.height / 2));
      if (r > 20) return r;
    }
    return FALLBACK_RADIUS;
  }

  /** OK by its word, else the last action (Cancel, OK); then the dialog closes */
  private async ok(seconds: number): Promise<void> {
    const buttons = this.dialog.locator(ACTIONS);
    const texts = (await buttons.allInnerTexts()).map((t) => t.trim().toLowerCase());
    if (texts.length === 0) throw new Error(`${this.what}'s clock has no OK button`);
    const at = texts.findIndex((t) => OK_WORDS.includes(t));
    await buttons.nth(at >= 0 ? at : texts.length - 1).click({ timeout: seconds * 1000 });
    const closed = await this.page.locator(DIALOG).waitFor({ state: 'hidden', timeout: seconds * 1000 }).then(() => true, () => false);
    if (!closed) throw new Error(`${this.what}'s clock did not close after OK`);
  }
}
