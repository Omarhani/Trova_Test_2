import { By } from '../by';
import { attrIs, textIs, xpathLiteral } from '../xpathText';
import { FIRST_DEPARTMENT, PendingRequestsTexts } from '../texts/PendingRequestsTexts';
import { BasePage } from './base/BasePage';

/** What a new employee is saved with on the Add employee drawer */
export interface NewEmployee {
  firstName: string;
  lastName: string;
  userName: string;
  jobNumber: string;
  department: string;
  jobTitle: string;
}

/** Registration Requests (طلبات التسجيل) - /pending-requests, with its Add / Edit employee drawer and delete confirm box */
export class PendingRequestsPage extends BasePage {
  // --- Locators ---
  private readonly pageHeading = By.xpath(`//h1[contains(normalize-space(),'طلبات التسجيل')]`);
  private readonly addEmployeeButton = By.xpath(`//button[${textIs(PendingRequestsTexts.addEmployee)}]`);
  private readonly incompleteTab = By.xpath(`//*[@role='tablist']//button[starts-with(normalize-space(),'غير مستكمل')]`);
  private readonly searchInput = By.xpath(`//input[${attrIs('placeholder', PendingRequestsTexts.search)}]`);
  private readonly drawer = By.xpath("//mat-dialog-container");
  private readonly firstNameInput = By.xpath("//mat-dialog-container//input[@formcontrolname='FirstName']");
  private readonly lastNameInput = By.xpath("//mat-dialog-container//input[@formcontrolname='LastName']");
  private readonly userNameInput = By.xpath("//mat-dialog-container//input[@formcontrolname='UserName']");
  private readonly jobNumberInput = By.xpath("//mat-dialog-container//input[@formcontrolname='JobNumber']");
  private readonly jobTitleInput = By.xpath("//mat-dialog-container//input[@formcontrolname='JobTitle']");
  private readonly departmentList = By.xpath("//mat-dialog-container//mat-select[@formcontrolname='DepartementId']");
  // the list's first option is its own search box - the first real department comes after it
  private readonly firstDepartmentOption = By.xpath("(//mat-option[@role='option' and not(contains(@class,'contains-mat-select-search'))])[1]");
  private readonly saveButton = By.xpath(`//mat-dialog-container//button[${textIs(PendingRequestsTexts.save)}]`);
  private readonly closeDrawerButton = By.xpath("//mat-dialog-container//button[.//i[contains(@class,'ri-close-line')]]");
  private readonly toastMessage = By.cssSelector('#toast-container .toast-message, mat-snack-bar-container, [role="alert"]');
  private readonly confirmMessage = By.xpath("//*[@role='dialog']//h2[@id='swal2-title']");
  private readonly okButton = By.xpath(`//*[@role='dialog']//button[${textIs(PendingRequestsTexts.ok)}]`);

  private departmentOption(name: string): string {
    return By.xpath(`//mat-option[@role='option'][normalize-space()=${xpathLiteral(name)}]`);
  }

  private rowOf(userName: string): string {
    return By.xpath(`//table//tbody//tr[td[normalize-space()=${xpathLiteral(userName)}]]`);
  }

  private editButtonOf(userName: string): string {
    return By.xpath(`//tr[td[normalize-space()=${xpathLiteral(userName)}]]//button[app-icon[@iconname='edit']]`);
  }

  private deleteButtonOf(userName: string): string {
    return By.xpath(`//tr[td[normalize-space()=${xpathLiteral(userName)}]]//button[app-icon[@iconname='delete']]`);
  }

  // --- Page actions ---
  /** the page is open: its heading shows */
  async waitShown(): Promise<void> {
    if (!(await this.isShownWithin(this.pageHeading, 20))) {
      throw new Error('The Registration Requests page did not open within 20 s');
    }
  }

  async openAddEmployee(): Promise<void> {
    await this.click(this.addEmployeeButton, 10, 'Add Employee button');
    await this.shown(this.firstNameInput, 10, 'The Add employee form');
  }

  async typeFirstName(firstName: string): Promise<void> {
    await this.type(this.firstNameInput, 10, firstName, 'First name');
  }

  async typeLastName(lastName: string): Promise<void> {
    await this.type(this.lastNameInput, 10, lastName, 'Last name');
  }

  async typeUserName(userName: string): Promise<void> {
    await this.type(this.userNameInput, 10, userName, 'User name');
  }

  async typeJobNumber(jobNumber: string): Promise<void> {
    await this.type(this.jobNumberInput, 10, jobNumber, 'Job number');
  }

  /** picks the department by its name, or the first real one when the data says "first department in the list" */
  async selectDepartment(department: string): Promise<void> {
    await this.click(this.departmentList, 10, 'Department list');
    const option = department.trim().toLowerCase() === FIRST_DEPARTMENT ? this.firstDepartmentOption : this.departmentOption(department);
    await this.click(option, 10, 'Department option');
  }

  async typeJobTitle(jobTitle: string): Promise<void> {
    await this.type(this.jobTitleInput, 10, jobTitle, 'Job title');
  }

  async clickSave(): Promise<void> {
    await this.click(this.saveButton, 10, 'Save button');
  }

  /** the success message after the last click, once it reads expected (the last one seen otherwise) */
  async toastAfterSave(expected: string): Promise<string> {
    return this.toastAfterAction(this.toastMessage, expected, 15);
  }

  /** true once the Add / Edit employee drawer has closed */
  async drawerClosed(): Promise<boolean> {
    return this.isGoneWithin(this.drawer, 15);
  }

  /** the First name the open Edit drawer shows, once it reads expected (what it holds otherwise) */
  async firstNameShown(expected: string): Promise<string> {
    return this.valueBecomes(this.firstNameInput, expected, 10);
  }

  /** the Job title the open Edit drawer shows, once it reads expected (what it holds otherwise) */
  async jobTitleShown(expected: string): Promise<string> {
    return this.valueBecomes(this.jobTitleInput, expected, 10);
  }

  /** closes the Add / Edit drawer with its close mark and waits until it is gone */
  async closeDrawer(): Promise<void> {
    await this.click(this.closeDrawerButton, 10, 'Close drawer button');
    if (!(await this.isGoneWithin(this.drawer, 10))) throw new Error('The employee drawer did not close within 10 s');
  }

  async openIncompleteTab(): Promise<void> {
    await this.click(this.incompleteTab, 10, 'Incomplete tab');
    await this.settled(10);
  }

  /** types the user name and presses Enter - the list filters only after Enter */
  async searchFor(userName: string): Promise<void> {
    await this.type(this.searchInput, 10, userName, 'Search');
    await this.pressKey(this.searchInput, 10, 'Enter', 'Search');
    await this.settled(10);
  }

  /** the rows showing this user name once their count is expected (waits up to 15 s) */
  async rowCountBecomes(userName: string, expected: number): Promise<number> {
    return this.countBecomes(this.rowOf(userName), expected, 15);
  }

  async openEditEmployee(userName: string): Promise<void> {
    await this.click(this.editButtonOf(userName), 10, 'Edit employee button');
    await this.shown(this.firstNameInput, 10, 'The Edit employee form');
  }

  async clickDelete(userName: string): Promise<void> {
    await this.click(this.deleteButtonOf(userName), 10, 'Delete button');
  }

  /** the confirm box's question once it shows ("" when none shows within 10 s) */
  async confirmMessageText(): Promise<string> {
    return this.messageOf(this.confirmMessage, 10);
  }

  async clickOk(): Promise<void> {
    await this.click(this.okButton, 10, 'OK button');
    await this.isGoneWithin(this.confirmMessage, 10);
    await this.settled(10);
  }
}
