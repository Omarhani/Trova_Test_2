/**
 * One part of an e-mail as it came from the mailbox: its headers (names in small letters, folded lines joined), its
 * type with its settings (charset, boundary) and its body with the transfer encoding (base64, quoted-printable) undone.
 * A multipart part holds its own parts.
 */
export interface MimePart {
  headers: Record<string, string>;
  type: string;
  params: Record<string, string>;
  body: Buffer;
  parts: MimePart[];
}

/** the whole e-mail (or one of its parts) read from its raw bytes */
export function parseMime(raw: Buffer): MimePart {
  const text = raw.toString('latin1');
  const split = /\r?\n\r?\n/.exec(text);
  const head = split ? text.slice(0, split.index) : text;
  const rest = split ? text.slice(split.index + split[0].length) : '';
  const headers = parseHeaders(Buffer.from(head, 'latin1').toString('utf8'));
  const { type, params } = contentType(headers['content-type']);
  const part: MimePart = { headers, type, params, body: Buffer.alloc(0), parts: [] };
  if (type.startsWith('multipart/') && params.boundary) part.parts = children(rest, params.boundary).map(parseMime);
  else part.body = undoTransfer(rest, headers['content-transfer-encoding']);
  return part;
}

/** the part's body as text, in its own charset (utf-8 when it names none or one this computer does not know) */
export function textOfBody(part: MimePart): string {
  try {
    return new TextDecoder(part.params.charset || 'utf-8').decode(part.body);
  } catch {
    return new TextDecoder('utf-8').decode(part.body);
  }
}

/** "=?UTF-8?B?...?=" / "=?utf-8?Q?...?=" words of a header made plain */
export function decodeWords(value: string): string {
  const joined = value.replace(/(\?=)\s+(=\?)/g, '$1$2');
  return joined.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_all, charset: string, kind: string, data: string) => {
    const bytes = kind.toUpperCase() === 'B'
      ? Buffer.from(data, 'base64')
      : Buffer.from(fromQuoted(data.replace(/_/g, ' ')), 'latin1');
    try {
      return new TextDecoder(charset).decode(bytes);
    } catch {
      return bytes.toString('utf8');
    }
  });
}

function parseHeaders(head: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const at = line.indexOf(':');
    if (at <= 0) continue;
    const name = line.slice(0, at).trim().toLowerCase();
    if (!(name in headers)) headers[name] = decodeWords(line.slice(at + 1).trim());
  }
  return headers;
}

function contentType(value = 'text/plain'): { type: string; params: Record<string, string> } {
  const [type, ...rest] = value.split(';');
  const params: Record<string, string> = {};
  for (const m of rest.join(';').matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|([^;\s]*))/g)) {
    params[m[1].toLowerCase()] = m[2] ?? m[3] ?? '';
  }
  return { type: type.trim().toLowerCase() || 'text/plain', params };
}

/** the parts between the boundary lines, each as its raw bytes */
function children(body: string, boundary: string): Buffer[] {
  const marker = `--${boundary}`;
  const pieces = body.split(marker).slice(1);
  const out: Buffer[] = [];
  for (const piece of pieces) {
    if (piece.startsWith('--')) break; // the closing boundary
    out.push(Buffer.from(piece.replace(/^\r?\n/, '').replace(/\r?\n$/, ''), 'latin1'));
  }
  return out;
}

function undoTransfer(body: string, encoding = ''): Buffer {
  const kind = encoding.trim().toLowerCase();
  if (kind === 'base64') return Buffer.from(body.replace(/\s+/g, ''), 'base64');
  if (kind === 'quoted-printable') return Buffer.from(fromQuoted(body.replace(/=\r?\n/g, '')), 'latin1');
  return Buffer.from(body, 'latin1');
}

function fromQuoted(text: string): string {
  return text.replace(/=([0-9A-Fa-f]{2})/g, (_all, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}
