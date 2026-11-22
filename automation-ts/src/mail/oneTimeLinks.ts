import { Email } from './email';

/** words a sign-in, reset or verify link carries in its address */
const TOKEN_WORDS = /token|code|key|reset|verif|confirm|activat|otp|sig|auth|magic|invite|password|secret/i;
/** a long random-looking part: letters and digits mixed, 16 or more */
const RANDOM = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9_.~%+=-]{16,}$/;
const LINKS = /https?:\/\/[^\s"'<>]+/g;

/**
 * true for a link that lets whoever has it in (a reset, verify, sign-in or invite link): a token-like word in its address
 * or a long random-looking part - it is hidden in the report like a password
 */
export function isOneTimeLink(link: string): boolean {
  let url: URL;
  try {
    url = new URL(link.replace(/&amp;/g, '&'));
  } catch {
    return false;
  }
  const parts = [...url.pathname.split('/'), ...[...url.searchParams.values()], url.hash.replace(/^#/, '')];
  return TOKEN_WORDS.test(url.search) || TOKEN_WORDS.test(url.hash) || parts.some((p) => RANDOM.test(p))
    || (url.search !== '' && TOKEN_WORDS.test(url.pathname));
}

/** every one-time link of the e-mail, as its words and as its HTML write it ("&" and "&amp;") */
export function oneTimeLinks(email: Email): string[] {
  const all = new Set<string>([...(email.text.match(LINKS) ?? []), ...(email.html.match(LINKS) ?? [])]);
  const out = new Set<string>();
  for (const link of all) {
    if (!isOneTimeLink(link)) continue;
    const plain = link.replace(/&amp;/g, '&');
    out.add(plain);
    out.add(plain.replace(/&/g, '&amp;'));
  }
  return [...out];
}
