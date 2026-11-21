import { By } from '../by';
import { testData } from '../../run/testData';
import { BasePage } from './base/BasePage';

/** What the add / edit employee drawer takes. */
export interface NewEmployee {
  firstName: string;
  lastName: string;
  userName: string;
  jobNumber: string;
  jobTitle: string;
}

/**
 * طلبات التسجيل (Registration Requests) - /pending-requests: the list of employees not yet active, its tabs and search,
 * and the add / edit employee drawer and the delete confirm that open on it.
 */
export class PendingRequestsPage extends BasePage {

  // --- Locators ---
  private readonly addEmployeeButton = By.xpath("//button[normalize-space()='اضافة موظف']");
  private readonly incompleteTab = By.xpath("//*[self::button or @role='button' or @role='tab'][normalize-space()='غير مستكمل' or starts-with(normalize-space(),'غير مستكمل ')]");
  private readonly searchInput = By.xpath("//input[@placeholder='بحث']");
  private readonly drawer = By.xpath("//mat-dialog-container");
  private readonly firstNameInput = By.xpath("//mat-dialog-container//*[@id=//label[normalize-space()='الاسم الأول']/@for]");
  private readonly lastNameInput = By.xpath("//mat-dialog-container//*[@id=//label[normalize-space()='الاسم الثاني']/@for]");
  private readonly userNameInput = By.xpath("//mat-dialog-container//*[@id=//label[normalize-space()='اسم المستخدم']/@for]");
  private readonly jobNumberInput = By.xpath("//mat-dialog-container//*[@id=//label[normalize-space()='الرقم الوظيفي']/@for]");
  private readonly jobTitleInput = By.xpath("//mat-dialog-container//*[@id=//label[normalize-space()='المسمى الوظيفي']/@for]");
  private readonly departmentSelect = By.xpath("//mat-dialog-container//mat-select[preceding::label[1][normalize-space()='الادارة']]");
  private readonly firstDepartmentOption = By.xpath("(//mat-option[not(.//input)][normalize-space()!=''])[1]");
  private readonly saveButton = By.xpath("//mat-dialog-container//button[normalize-space()='حفظ']");
  private readonly toastMessage = By.xpath("//*[contains(@class,'toast-message') or @role='alert' or contains(@class,'mat-mdc-snack-bar-label')]");
  private readonly confirmMessage = By.xpath("//*[@role='dialog']//*[contains(normalize-space(),'هل أنت متأكد')][not(*[contains(normalize-space(),'هل أنت متأكد')])]");
  private readonly okButton = By.xpath("//*[@role='dialog']//button[normalize-space()='موافق']");

  private rowOf(userName: string): string {
    return By.xpath("//*[self::tr or @role='row'][.//*[normalize-space()='" + userName + "']]");
  }

  private editButtonOf(userName: string): string {
    return By.xpath("//*[self::tr or @role='row'][.//*[normalize-space()='" + userName + "']]//button[.//app-icon[@iconname='edit']]");
  }

  private deleteButtonOf(userName: string): string {
    return By.xpath("//*[self::tr or @role='row'][.//*[normalize-space()='" + userName + "']]//button[.//app-icon[@iconname='delete']]");
  }

  // --- Page actions ---
  /** opens طلبات التسجيل and waits for its list to be ready */
  async openRegistrationRequests(): Promise<this> {
    await this.open(new URL('pending-requests', testData.webUrl()).toString());
    if (!(await this.isShownWithin(this.addEmployeeButton, 20))) {
      throw new Error('The Registration Requests page did not open within 20 s');
    }
    await this.settled(10);
    return this;
  }

  async clickAddEmployee(): Promise<void> {
    await this.click(this.addEmployeeButton, 10, 'اضافة موظف');
  }

  /** fills the add employee drawer, the first department in the list picked */
  async fillNewEmployee(employee: NewEmployee): Promise<void> {
    await this.type(this.firstNameInput, 10, employee.firstName, 'الاسم الأول');
    await this.type(this.lastNameInput, 10, employee.lastName, 'الاسم الثاني');
    await this.type(this.userNameInput, 10, employee.userName, 'اسم المستخدم');
    await this.type(this.jobNumberInput, 10, employee.jobNumber, 'الرقم الوظيفي');
    await this.selectFirstDepartment();
    await this.type(this.jobTitleInput, 10, employee.jobTitle, 'المسمى الوظيفي');
  }

  async selectFirstDepartment(): Promise<void> {
    await this.click(this.departmentSelect, 10, 'الادارة');
    await this.click(this.firstDepartmentOption, 10, 'first department');
  }

  async clickSave(): Promise<void> {
    await this.click(this.saveButton, 10, 'حفظ');
  }

  /** the toast the save showed (waited for, one that came and went counts); "" when none */
  async toastAfterSave(expected: string): Promise<string> {
    return this.toastAfterAction(this.toastMessage, expected, 15);
  }

  /** true once the drawer has closed */
  async drawerClosed(): Promise<boolean> {
    return this.isGoneWithin(this.drawer, 15);
  }

  async openIncompleteTab(): Promise<void> {
    await this.click(this.incompleteTab, 10, 'غير مستكمل');
    await this.settled(10);
  }

  /** types the user name in the search box and presses Enter (the list filters only after Enter) */
  async searchFor(userName: string): Promise<void> {
    await this.type(this.searchInput, 10, userName, 'بحث');
    await this.pressKey(this.searchInput, 10, 'Enter', 'بحث');
    await this.settled(10);
  }

  /** the rows showing the user name, once at least one shows (waits up to 15 s); 0 when none came */
  async rowsShowing(userName: string): Promise<number> {
    return this.rowsShownWithin(this.rowOf(userName), 15);
  }

  /** the rows showing the user name once the list has none of them (waits up to 15 s); the last count otherwise */
  async rowsAfterRemoval(userName: string): Promise<number> {
    return this.countBecomes(this.rowOf(userName), 0, 15);
  }

  async clickEditEmployee(userName: string): Promise<void> {
    await this.click(this.editButtonOf(userName), 10, 'تعديل الموظف');
  }

  async changeFirstName(firstName: string): Promise<void> {
    await this.type(this.firstNameInput, 10, firstName, 'الاسم الأول');
  }

  async changeJobTitle(jobTitle: string): Promise<void> {
    await this.type(this.jobTitleInput, 10, jobTitle, 'المسمى الوظيفي');
  }

  async clickDeleteOf(userName: string): Promise<void> {
    await this.click(this.deleteButtonOf(userName), 10, 'delete');
  }

  /** the delete confirm's question once it shows; "" when none */
  async confirmQuestion(): Promise<string> {
    return this.messageOf(this.confirmMessage, 10);
  }

  async clickOk(): Promise<void> {
    await this.click(this.okButton, 10, 'موافق');
    await this.settled(10);
  }
}
