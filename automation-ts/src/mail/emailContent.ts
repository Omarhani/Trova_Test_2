import { MimePart, textOfBody } from './mimeParts';

/** "<b>x</b>" -> "&lt;b&gt;x&lt;/b&gt;" - text shown safely inside a page */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** an HTML body as the words a person reads (scripts and styles left out, the common marks made plain) */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&#43;/g, '+').replace(/&#64;/g, '@').replace(/&amp;/g, '&')
    .replace(/ /g, ' ');
}

/**
 * an e-mail's HTML made inert for the report: scripts, frames, objects and forms out, no event handler (onclick, onerror
 * ...) and no script link (javascript:) - the look stays, nothing in it runs
 */
export function inertHtml(html: string): string {
  return html
    .replace(/<(script|iframe|object|embed|frame|frameset|form|base|meta)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(script|iframe|object|embed|frame|frameset|form|base|meta)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|action|xlink:href)\s*=\s*(["']?)\s*(javascript|vbscript|data:text\/html)[^"'\s>]*\2/gi, '$1="#"');
}

/** every text part's words, HTML ones made plain, in their order */
export function textOf(part: MimePart): string {
  if (part.type === 'text/plain') return textOfBody(part);
  if (part.type === 'text/html') return htmlToText(textOfBody(part));
  if (part.type.startsWith('multipart/')) return part.parts.map((p) => `${textOf(p)}\n`).join('');
  return '';
}

/**
 * how the e-mail looks: its first HTML part with its inline pictures (cid:) carried along as data addresses, or its text
 * in a <pre> when it has no HTML
 */
export function lookOf(part: MimePart, text: string): string {
  const images: Record<string, string> = {};
  let html = firstHtml(part, images);
  if (html === undefined) html = `<pre style="white-space:pre-wrap;font:14px sans-serif">${escapeHtml(text)}</pre>`;
  for (const [id, uri] of Object.entries(images)) html = html.split(`cid:${id}`).join(uri);
  return inertHtml(html);
}

function firstHtml(part: MimePart, images: Record<string, string>): string | undefined {
  if (part.type === 'text/html') return textOfBody(part);
  if (part.type.startsWith('image/') && part.headers['content-id']) {
    images[part.headers['content-id'].replace(/^<|>$/g, '')] = `data:${part.type};base64,${part.body.toString('base64')}`;
    return undefined;
  }
  let html: string | undefined;
  for (const child of part.parts) {
    const found = firstHtml(child, images);
    if (html === undefined) html = found;
  }
  return html;
}
