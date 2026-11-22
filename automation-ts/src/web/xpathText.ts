/**
 * Text inside an XPath, safely: one locator for every app language - the texts of one element joined
 * with or - and any value pasted into an XPath (a user name, a record's title) as a literal that never breaks on a quote.
 * The texts of a page or feature live in one shared texts file, so a text changes in one place:
 *   export const EmployeesTexts = { addEmployee: ['اضافة موظف', 'Add Employee'] } as const;
 *   private readonly addEmployeeButton = By.xpath(`//button[${textIs(EmployeesTexts.addEmployee)}]`);
 */

/** an XPath string literal for any value: 'a', "a'b", or concat(...) when it holds both quote kinds */
export function xpathLiteral(value: string): string {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  return `concat(${value.split("'").map((part) => `'${part}'`).join(`, "'", `)})`;
}

/** what an element's own text must be, in any of the given languages: normalize-space()='a' or normalize-space()='b' */
export function textIs(texts: readonly string[]): string {
  return anyEqual('normalize-space()', texts);
}

/** what an attribute must be, in any of the given languages: @placeholder='a' or @placeholder='b' */
export function attrIs(attribute: string, texts: readonly string[]): string {
  return anyEqual(`@${attribute}`, texts);
}

function anyEqual(left: string, texts: readonly string[]): string {
  if (texts.length === 0) throw new Error('A text locator needs at least one text');
  return texts.map((t) => `${left}=${xpathLiteral(t)}`).join(' or ');
}
