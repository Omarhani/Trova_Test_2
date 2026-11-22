import { BasePage } from '../base/BasePage';
import { By } from '../../by';

/** The data the add-employee drawer asks for. */
export interface NewEmployee {
  firstName: string;
  lastName: string;
  userName: string;
  jobNumber: string;
  department: string;
  jobTitle: string;
}

/** "first department in the list" (or blank) = the first real department after the list's own search box */
const FIRST_DEPARTMENT = /^\s*$|^first department/i;

/** The add / edit employee drawer of Registration Requests (اضافة موظف / تعديل الموظف). */
export class EmployeeDrawer extends BasePage {
  // --- Locators ---
  private readonly drawer = By.xpath("//mat-dialog-container");
  private readonly firstNameInput = By.xpath("//mat-dialog-container//input[@placeholder='الاسم الأول']");
  private readonly lastNameInput = By.xpath("//mat-dialog-container//input[@placeholder='الاسم الثاني']");
  private readonly userNameInput = By.xpath("//mat-dialog-container//input[@placeholder='اسم المستخدم']");
  private readonly jobNumberInput = By.xpath("//mat-dialog-container//input[@placeholder='الرقم الوظيفي']");
  private readonly jobTitleInput = By.xpath("//mat-dialog-container//*[@aria-label='المسمى الوظيفي' or @id=//label[normalize-space()='المسمى الوظيفي']/@for]");
  private readonly departmentList = By.xpath("//mat-dialog-container//mat-select[preceding::label[1][starts-with(normalize-space(),'الادارة')]]");
  private readonly firstDepartmentOption = By.xpath("(//mat-option[@role='option' and @aria-disabled='false'])[1]");
  private readonly saveButton = By.xpath("//mat-dialog-container//button[normalize-space()='حفظ']");
  private readonly toast = By.xpath("//*[@id='toast-container']//*[contains(@class,'toast-message')] | //*[@role='alert']");

  private departmentOption(name: string): string {
    return By.xpath("//mat-option[@role='option'][normalize-space()='" + name + "']");
  }

  // --- Page actions ---
  async isOpen(): Promise<boolean> {
    return this.isShownWithin(this.drawer, 15);
  }

  async fillNewEmployee(employee: NewEmployee): Promise<void> {
    await this.type(this.firstNameInput, 15, employee.firstName, 'الاسم الأول (First name)');
    await this.type(this.lastNameInput, 10, employee.lastName, 'الاسم الثاني (Last name)');
    await this.type(this.userNameInput, 10, employee.userName, 'اسم المستخدم (User name)');
    await this.type(this.jobNumberInput, 10, employee.jobNumber, 'الرقم الوظيفي (Job number)');
    await this.selectDepartment(employee.department);
    await this.type(this.jobTitleInput, 10, employee.jobTitle, 'المسمى الوظيفي (Job title)');
  }

  async selectDepartment(department: string): Promise<void> {
    await this.click(this.departmentList, 10, 'الادارة (Department)');
    const option = FIRST_DEPARTMENT.test(department) ? this.firstDepartmentOption : this.departmentOption(department.trim());
    await this.click(option, 10, 'department ' + department);
  }

  async changeFirstName(firstName: string): Promise<void> {
    await this.type(this.firstNameInput, 15, firstName, 'الاسم الأول (First name)');
  }

  async changeJobTitle(jobTitle: string): Promise<void> {
    await this.type(this.jobTitleInput, 10, jobTitle, 'المسمى الوظيفي (Job title)');
  }

  async clickSave(): Promise<void> {
    await this.click(this.saveButton, 10, 'حفظ (Save)');
  }

  /** the toast shown after Save (waited for; one that came and went counts); "" when none showed */
  async toastAfterSave(expected: string): Promise<string> {
    return this.toastAfterAction(this.toast, expected, 15);
  }

  /** true once the drawer has closed (up to 15 s) */
  async isClosed(): Promise<boolean> {
    return this.isGoneWithin(this.drawer, 15);
  }
}
