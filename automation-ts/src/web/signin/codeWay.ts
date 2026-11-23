import { Page } from '@playwright/test';
import { onPage, STATE } from './signInScripts';

/**
 * after the password the app asks how to send its one-time code - e-mail or text message, then its send
 * button - before any code box shows. The same words and page code as the AI tools (agent-tools trova-login-code-way.ts),
 * so a run and an AI session treat that dialog alike. Any app, any language. Reads no value.
 */

/** words of a dialog button that is not the send button: cancel, close, back, resend, "try another way" */
const NO_WORDS = 'إلغاء|الغاء|اغلاق|إغلاق|cancel|close|back|رجوع|resend|إعادة إرسال|اعادة ارسال|إعادة الإرسال|طريقة أخرى|طريقة اخرى|طريقه اخرى|another way';

/**
 * page code: the open code-way dialog - a way picked unless one is (arguments[1] = the way Test Data names, else e-mail,
 * else the first), its send button pressed; "sent" or null. Only radios (or 2+ check boxes) are ways, and a
 * cookie / consent / terms / privacy / newsletter dialog is never touched (no consent is ever given).
 */
export const CHOOSE = String.raw`return (async function () {
  var DIALOG = '[role=dialog], [role=alertdialog], dialog[open], .modal.show, .modal.in, .mat-dialog-container, .mat-mdc-dialog-container, .cdk-overlay-pane, .swal2-popup, .ant-modal, .p-dialog, .el-dialog';
  var WAY = /رمز|تحقق|otp|code|verif|sms|رسالة|بريد|e-?mail|text message/i;
  var NO = new RegExp(arguments[0], 'i');
  var YES = /إرسال|ارسال|تأكيد|تاكيد|متابعة|التالي|send|confirm|continue|next|submit|ok\b/i;
  var seen = function (e) { var r = e.getBoundingClientRect(); var s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; };
  var typed = function (d) { return Array.prototype.slice.call(d.querySelectorAll('input, textarea')).some(function (e) { return seen(e) && !e.readOnly
    && ['hidden', 'checkbox', 'radio', 'submit', 'button', 'file'].indexOf(e.type) < 0; }); };
  var CONSENT = /cookie|consent|terms|privacy|newsletter|subscribe|الخصوصية|الشروط|الأحكام|ملفات تعريف|النشرة/i;
  var list = function (d, q) { return Array.prototype.slice.call(d.querySelectorAll(q)); };
  var ways = function (d) { var radios = list(d, 'input[type=radio], [role=radio], mat-radio-button');
    if (radios.length) return radios; var boxes = list(d, 'input[type=checkbox], [role=checkbox], mat-checkbox');
    return boxes.length > 1 ? boxes : []; };
  var scope = list(document, DIALOG).filter(seen).reverse().find(function (d) { var t = d.innerText || '';
    return WAY.test(t) && !CONSENT.test(t) && !typed(d) && ways(d).length; });
  if (!scope) return null;
  var on = function (o) { return o.checked || o.getAttribute('aria-checked') === 'true' || /(^|\s|-)checked\b/.test(String(o.className || '')); };
  var holder = function (o) { return o.closest('label, mat-radio-button, mat-checkbox, [role=radio], [role=checkbox]') || o.parentElement || o; };
  var label = function (o) { return [holder(o).innerText, o.value, o.getAttribute('aria-label')].filter(Boolean).join(' '); };
  var MAIL = /بريد|e-?mail|mail/i, SMS = /sms|text|رسالة|نصية|جوال|هاتف|phone|mobile/i;
  var want = String(arguments[1] || '').trim();
  var like = MAIL.test(want) ? MAIL : SMS.test(want) ? SMS : want ? new RegExp(want.replace(/[^\p{L}\p{N} ]+/gu, '.'), 'iu') : MAIL;
  var all = ways(scope);
  if (!all.some(on)) { var o = all.find(function (x) { return like.test(label(x)); }) || all[0];
    (seen(o) ? o : holder(o)).click(); }
  var text = function (b) { return [b.innerText, b.value, b.getAttribute('aria-label'), b.getAttribute('title')].filter(Boolean).join(' ').trim(); };
  var send = function () { return Array.prototype.slice.call(scope.querySelectorAll('button, input[type=submit], [role=button]')).find(function (b) {
    return seen(b) && YES.test(text(b)) && !NO.test(text(b)) && !b.disabled && b.getAttribute('aria-disabled') !== 'true'; }); };
  for (var t = 0; t < 3000; t += 150) { var b = send(); if (b) { b.click(); return 'sent'; }
    await new Promise(function (r) { setTimeout(r, 150); }); }
  return null;
}).apply(null, arguments);`;

/** the way to get the code, sent at most once per sign-in (a second press would ask the app for a new code) */
export class CodeWay {
  private sent = false;

  /** codeSaved: the saved steps have a code step; want: the way Test Data names ("" = e-mail, else the first) */
  constructor(private readonly codeSaved: boolean, private readonly want: string) {}

  /** true when the page asked how to send the code and Trova sent it now */
  async send(page: Page): Promise<boolean> {
    if (this.sent || !(await this.mayAsk(page))) return false;
    this.sent = (await onPage<string | null>(page, CHOOSE, NO_WORDS, this.want)) === 'sent';
    return this.sent;
  }

  /** with no saved code step, only a page with no code box and no password box may be the way dialog */
  private async mayAsk(page: Page): Promise<boolean> {
    if (this.codeSaved) return true;
    const s = await onPage<{ pw?: boolean; mid?: boolean }>(page, STATE);
    return !!s && !s.pw && !s.mid;
  }
}

/** the way the login's Test Data names ("Code way": e-mail / sms ...), "" when it names none */
export function wayWanted(fields: Record<string, string>): string {
  const hit = Object.entries(fields).find(([k, v]) => /(way|method|channel|طريقة|وسيلة)/i.test(k) && v?.trim());
  return hit ? hit[1].trim() : '';
}
