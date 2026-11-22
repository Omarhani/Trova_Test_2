import { test } from '@playwright/test';
import { CODE, Email, LINK, PASSWORD, USERNAME } from '../mail/email';
import { escapeHtml } from '../mail/emailContent';
import { emailReader } from '../mail/emailReader';
import { isOneTimeLink, oneTimeLinks } from '../mail/oneTimeLinks';
import { emit } from './liveEvents';
import { fileNamePart, keepFileWithRun } from './runReportFolder';
import { SecretValues, secretValues } from './secretValues';
import { nextStep } from './stepNumbers';
import { typedValue } from './typedValue';

/** where the e-mail goes: the run's secrets, its step lines, the test's attachments and the run's report folder */
export interface EmailReportParts {
  secrets: SecretValues;
  step(fields: Record<string, unknown>): void;
  attach(name: string, html: string): Promise<void>;
  keep(name: string, html: string): void;
}

const RUN_PARTS: EmailReportParts = {
  secrets: secretValues,
  step: (fields) => emit('step', { n: nextStep(), ...fields }),
  attach: async (name, html) => {
    try {
      await test.info().attach(name, { body: html, contentType: 'text/html' });
    } catch {
      // not inside a test (a set-up script): the run's report folder still has it
    }
  },
  keep: (name, html) => { keepFileWithRun(name, html); },
};

/** the values an e-mail of an app usually carries: the user name, the password, else the code */
function usualValues(email: Email): Record<string, string | undefined> {
  const password = email.value(PASSWORD);
  return { 'User name': email.value(USERNAME), Password: password, ...(password ? {} : { Code: email.value(CODE) }), Link: email.value(LINK) };
}

function page(email: Email): string {
  const when = (d?: Date): string => (d ? d.toISOString().replace('T', ' ').slice(0, 19) : '');
  const rows = [['From', email.from], ['To', email.to], ['Subject', email.subject], ['Sent', when(email.sent)], ['Received', when(email.received)]]
    .map(([name, value]) => `<tr><th style="text-align:left;padding:4px 10px">${name}</th><td style="padding:4px 10px">${escapeHtml(value)}</td></tr>`)
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(email.subject)}</title></head>`
    + `<body style="margin:0;background:#fff"><table style="font:13px sans-serif;margin:8px">${rows}</table>${email.html}</body></html>`;
}

/**
 * Shows the e-mail a test waited for (by default the one emailReader found last) in the test's report: one line with its
 * subject and sender, one line per value the test took out of it (a password, code or one-time link as *** with its
 * reference, as a typed secret), and the e-mail itself as the user sees it - attached to the test and kept with the run, its secrets
 * hidden. Nothing when no e-mail was found.
 */
export async function showEmail(email: Email | undefined = emailReader.last(), title = 'Email',
                                values?: Record<string, string | undefined>, parts: EmailReportParts = RUN_PARTS): Promise<void> {
  if (!email) return;
  for (const link of oneTimeLinks(email)) parts.secrets.keep(link); // a reset / verify link lets whoever has it in
  parts.step({ a: 'read', e: title, v: parts.secrets.hide(`${email.subject} - from ${email.from}`) });
  for (const [name, value] of Object.entries(values ?? usualValues(email))) {
    if (value) parts.step({ a: 'read', e: `${title} · ${name}`, ...typedValue(name, '', value, isOneTimeLink(value), parts.secrets) });
  }
  const html = parts.secrets.hide(page(email));
  await parts.attach(title, html);
  parts.keep(`${fileNamePart(title)}-email.html`, html);
}
