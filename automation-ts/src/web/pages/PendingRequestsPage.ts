import { By } from '../by';
import { TOAST } from '../toastWatch';
import { BasePage } from './base/BasePage';
import { EmployeeDrawer, NewEmployee } from './pendingRequests/EmployeeDrawer';

/** طلبات التسجيل (Registration Requests) - /pending-requests: the requests list, its tabs, search and row actions. */
export class PendingRequestsPage extends BasePage {
  // --- Locators ---
  private readonly pageTitle = By.xpath("//h1[contains(normalize-space(),'طلبات التسجيل')]");
  private readonly addEmployeeButton = By.xpath("//button[normalize-space()='اضافة موظف']");
  private readonly incompleteTab = By.xpath("//button[starts-with(normalize-space(),'غير مستكمل')]");
  private readonly searchInput = By.xpath("//input[@placeholder='بحث']");
  private readonly confirmMessage = By.xpath("//*[@role='dialog']//h2[@id='swal2-title']");
  private readonly okButton = By.xpath("//*[@role='dialog']//button[normalize-space()='موافق']");
  private readonly toast = By.cssSelector(TOAST);

  private rowOf(userName: string): string {
    return By.xpath("//tbody//tr[td[normalize-space()='" + userName + "']]");
  }

  private editButtonOf(userName: string): string {
    return By.xpath("//tr[td[normalize-space()='" + userName + "']]//button[.//app-icon[@iconname='edit']]");
  }

  private deleteButtonOf(userName: string): string {
    return By.xpath("//tr[td[normalize-space()='" + userName + "']]//button[.//app-icon[@iconname='delete']]");
  }

  // --- Page actions ---
  async waitUntilShown(): Promise<void> {
    if (!(await this.isShownWithin(this.pageTitle, 20))) {
      throw new Error('The Registration Requests page did not show within 20 s');
    }
  }

  /** opens the add drawer and fills it in - Save is left to the caller */
  async addEmployee(employee: NewEmployee): Promise<EmployeeDrawer> {
    await this.click(this.addEmployeeButton, 15, 'اضافة موظف');
    const drawer = new EmployeeDrawer(this.page);
    await drawer.fillNewEmployee(employee);
    return drawer;
  }

  async openIncompleteTab(): Promise<void> {
    await this.click(this.incompleteTab, 15, 'غير مستكمل');
  }

  /** the list filters only after Enter */
  async searchFor(text: string): Promise<void> {
    await this.type(this.searchInput, 15, text, 'بحث');
    await this.pressKey(this.searchInput, 10, 'Enter', 'بحث');
  }

  async openEditEmployee(userName: string): Promise<EmployeeDrawer> {
    await this.click(this.editButtonOf(userName), 15, 'تعديل الموظف');
    return new EmployeeDrawer(this.page);
  }

  async clickDeleteOn(userName: string): Promise<void> {
    await this.click(this.deleteButtonOf(userName), 15, 'delete');
  }

  async confirmMessageText(): Promise<string> {
    return this.messageOf(this.confirmMessage, 10);
  }

  async confirmOk(): Promise<void> {
    await this.click(this.okButton, 10, 'موافق');
  }

  /** the rows of this user name once the list shows that many (waits up to 15 s) */
  async rowsOfBecome(userName: string, expected: number): Promise<number> {
    return this.countBecomes(this.rowOf(userName), expected, 15);
  }

  /** the toast shown since the last click, once it reads expected; the last one seen otherwise */
  async toastAfterSave(expected: string): Promise<string> {
    return this.toastAfterAction(this.toast, expected, 15);
  }
}
