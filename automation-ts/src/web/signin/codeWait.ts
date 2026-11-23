/**
 * For ANY app: what an app's answer means about its one-time codes - "wait
 * before a new code / the code is still valid" (then the time it names), or a hard no (a wrong code, a locked account,
 * a wrong password) that no wait can fix. A small hint list in several languages, kept only for speed; it never holds
 * one app's exact words.
 */

/** a code word in common languages */
const CODE = '(code|otp|pin|codigo|código|kod|رمز|كود|الكود|verification|vérification|verifizierung)';
const TOO_SOON: RegExp[] = [
  new RegExp(`(wait|patient|patienter|warten|espere|esperar|bekle).{0,60}${CODE}`, 'i'),
  new RegExp(`${CODE}.{0,40}(still valid|still active|already sent|not expired|encore valide|noch gültig|todavía válido|aún válido)`, 'i'),
  /(cannot|can't|can not|not allowed to|unable to) (re-?send|send a new|request a new|send another).{0,40}(before|until|yet)/i,
  /(too many|too soon|too early).{0,30}(code|request|attempt)/i,
  /code (cannot|can't|can not) be (re-?)?sent (before|until|yet)/i,
  /(لا ?يمكن(ك)?|لايمكن(ك)?) ?(إ|ا)عادة (ال)?(إ|ا)رسال.{0,40}(قبل|حتى|بعد)/,
  /(انتظر|يرجى الانتظار|الرجاء الانتظار).{0,60}(رمز|كود|الكود)/,
  /(رمز|كود|الكود).{0,30}(لا ?يزال|مازال|ما زال) ?(صالح|فعال)/,
];

/** a no no wait can fix: a wrong code, a locked account, a wrong user name or password */
const HARD_NO: RegExp[] = [
  /(invalid|incorrect|wrong|bad|expired)\s.{0,30}(code|otp|pin)|(code|otp|pin).{0,30}(invalid|incorrect|wrong|does not match|is not valid)/i,
  /(account|user).{0,20}(locked|blocked|suspended|disabled)|(locked|blocked) out/i,
  /(invalid|incorrect|wrong|bad).{0,30}(user|password|credential|login)|(user|password|credential).{0,30}(invalid|incorrect|wrong|not match)/i,
  /(رمز|كود|الكود).{0,30}(غير صحيح|خاطئ|خطأ|غير صالح)/,
  /(الحساب|المستخدم).{0,20}(مقفل|موقوف|محظور|معطل)/,
  /(كلمة (ال)?(مرور|سر)|اسم المستخدم).{0,30}(غير صحيح|خاطئ|خطأ)/,
];

/** the app will not send a new one-time code yet (a sign-in just before asked for one) - any language */
export function codeTooSoon(said: string | undefined): boolean {
  return !!said && !hardNo(said) && TOO_SOON.some((p) => p.test(said));
}

/** a wrong code, a locked account, a wrong user name or password: fails at once, never waited */
export function hardNo(said: string | undefined): boolean {
  return !!said && HARD_NO.some((p) => p.test(said));
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const UNITS: [RegExp, number][] = [
  [/^(s|sec|secs|second|seconds|seconde|secondes|sekunde|sekunden|segundo|segundos|saniye|ثانية|ثواني|ثوان)$/i, 1000],
  [/^(m|min|mins|minute|minutes|minuten|minuto|minutos|dakika|دقيقة|دقائق|دقيقتين)$/i, 60_000],
];

/** the time the app's answer names ("try again in 90 seconds", "انتظر ٢ دقيقة"), in ms; undefined = none named */
export function namedWaitMs(said: string | undefined): number | undefined {
  const text = (said ?? '').replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
  for (const m of text.matchAll(/(\d+)\s*([^\s\d.,!?;:)]+)/g)) {
    const unit = UNITS.find(([re]) => re.test(m[2]));
    if (unit && Number(m[1]) > 0) return Number(m[1]) * unit[1];
  }
  return undefined;
}

/** a code step in a sign-in (recipe calls or screen steps): a verify / OTP / one-time / 2FA call or field - an account code is none */
const ASKS_CODE = /verif|otp|one[\s_-]?time|\b2fa\b|\bmfa\b|totp|sms[\s_-]?code|رمز التحقق/i;

/** only a sign-in that really asks a code is a code request (a kept sign-in, user name + password are not) */
export function usesCode(signIn: unknown): boolean {
  return signIn !== undefined && signIn !== null && ASKS_CODE.test(JSON.stringify(signIn));
}

/** the page's own words say "wait for a new code" (a wrong code with the code box open is no wait) */
export async function saysTooSoon(words: () => Promise<string>): Promise<boolean> {
  try {
    return codeTooSoon(await words());
  } catch {
    return false;
  }
}
