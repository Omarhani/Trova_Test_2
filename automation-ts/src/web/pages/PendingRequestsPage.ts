import { BasePage } from './base/BasePage';
import { By } from '../by';
import { EmployeeDrawer } from './pendingRequests/EmployeeDrawer';

/** طلبات التسجيل (Registration Requests) - /pending-requests: the requests list, its tabs, search and row actions. */
export class PendingRequestsPage extends BasePage {
  // --- Locators ---
  private readonly pageTitle = By.xpath("//h1[contains(normalize-space(),'طلبات التسجيل')]");
  private readonly addEmployeeButton = By.xpath("//button[normalize-space()='اضافة موظف']");
  private readonly incompleteTab = By.xpath("//*[self::button or @role='button'][normalize-space()='غير مستكمل']");
  private readonly searchInput = By.xpath("//input[@placeholder='بحث']");
  private readonly confirmQuestion = By.xpath("//*[@role='dialog']//h2[@id='swal2-title']");
  private readonly okButton = By.xpath("//*[@role='dialog']//button[normalize-space()='موافق']");

  private rowOf(userName: string): string {
    return By.xpath("//tbody//tr[.//*[normalize-space()='" + userName + "']]");
  }

  private editButtonOf(userName: string): string {
    return By.xpath("//tbody//tr[.//*[normalize-space()='" + userName + "']]//button[.//app-icon[@iconname='edit']]");
  }

  private deleteButtonOf(userName: string): string {
    return By.xpath("//tbody//tr[.//*[normalize-space()='" + userName + "']]//button[.//app-icon[@iconname='delete']]");
  }

  // --- Page actions ---
  /** waits until the Registration Requests page shows (its title) */
  async waitUntilShown(): Promise<void> {
    if (!(await this.isShownWithin(this.pageTitle, 20))) {
      throw new Error('The Registration Requests page did not show within 20 s');
    }
  }

  async clickAddEmployee(): Promise<EmployeeDrawer> {
    await this.click(this.addEmployeeButton, 15, 'اضافة موظف (Add Employee)');
    return this.openedDrawer('Add Employee');
  }

  async openIncompleteTab(): Promise<void> {
    await this.click(this.incompleteTab, 15, 'غير مستكمل (Incomplete) tab');
  }

  /** types the text in the search box and presses Enter (the list filters only after Enter) */
  async searchFor(text: string): Promise<void> {
    await this.type(this.searchInput, 15, text, 'بحث (Search)');
    await this.pressKey(this.searchInput, 10, 'Enter', 'بحث (Search)');
  }

  /** the rows of this user name once the list settled on none (up to 15 s); the last count otherwise */
  async rowsAfterRemoval(userName: string): Promise<number> {
    return this.countBecomes(this.rowOf(userName), 0, 15);
  }

  async clickEditEmployee(userName: string): Promise<EmployeeDrawer> {
    await this.click(this.editButtonOf(userName), 15, 'تعديل الموظف (Edit Employee) of ' + userName);
    return this.openedDrawer('Edit Employee');
  }

  async clickDeleteOf(userName: string): Promise<void> {
    await this.click(this.deleteButtonOf(userName), 15, 'delete icon of ' + userName);
  }

  /** the confirm question's words once it shows; "" when none showed */
  async confirmQuestionText(): Promise<string> {
    return this.messageOf(this.confirmQuestion, 10);
  }

  async clickOk(): Promise<void> {
    await this.click(this.okButton, 10, 'موافق (OK)');
    if (!(await this.isGoneWithin(this.confirmQuestion, 15))) {
      throw new Error('The confirm message did not close within 15 s after موافق (OK)');
    }
  }

  private async openedDrawer(name: string): Promise<EmployeeDrawer> {
    const drawer = new EmployeeDrawer(this.page);
    if (!(await drawer.isOpen())) throw new Error(`The ${name} drawer did not open within 15 s`);
    return drawer;
  }
}
