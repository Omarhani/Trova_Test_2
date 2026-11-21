import { By } from '../../by';
import { BasePage } from '../base/BasePage';

export interface NewEmployee {
  firstName: string;
  lastName: string;
  userName: string;
  jobNumber: string;
  jobTitle: string;
}

/** The add / edit employee drawer of Registration Requests (a pop-up on /pending-requests). */
export class EmployeeDrawer extends BasePage {
  // --- Locators ---
  private readonly drawer = By.xpath("//mat-dialog-container");
  private readonly firstNameInput = By.xpath("//mat-dialog-container//*[@aria-label='الاسم الأول' or @id=//label[normalize-space()='الاسم الأول']/@for]");
  private readonly lastNameInput = By.xpath("//mat-dialog-container//*[@aria-label='الاسم الثاني' or @id=//label[normalize-space()='الاسم الثاني']/@for]");
  private readonly userNameInput = By.xpath("//mat-dialog-container//*[@aria-label='اسم المستخدم' or @id=//label[normalize-space()='اسم المستخدم']/@for]");
  private readonly jobNumberInput = By.xpath("//mat-dialog-container//*[@aria-label='الرقم الوظيفي' or @id=//label[normalize-space()='الرقم الوظيفي']/@for]");
  private readonly departmentSelect = By.xpath("//mat-dialog-container//mat-select[preceding::label[1][normalize-space()='الادارة']]");
  // the list's first option is its own search box - the first real department comes after it
  private readonly firstDepartmentOption = By.xpath("(//mat-option[not(contains(@class,'contains-mat-select-search')) and @aria-disabled='false'])[1]");
  private readonly jobTitleInput = By.xpath("//mat-dialog-container//*[@aria-label='المسمى الوظيفي' or @id=//label[normalize-space()='المسمى الوظيفي']/@for]");
  private readonly saveButton = By.xpath("//mat-dialog-container//button[normalize-space()='حفظ']");

  // --- Page actions ---
  async fillNewEmployee(employee: NewEmployee): Promise<void> {
    await this.type(this.firstNameInput, 15, employee.firstName, 'الاسم الأول');
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

  async changeFirstName(firstName: string): Promise<void> {
    await this.type(this.firstNameInput, 15, firstName, 'الاسم الأول');
  }

  async changeJobTitle(jobTitle: string): Promise<void> {
    await this.type(this.jobTitleInput, 10, jobTitle, 'المسمى الوظيفي');
  }

  async save(): Promise<void> {
    await this.click(this.saveButton, 10, 'حفظ');
  }

  /** true once the drawer closed (waits up to 10 s) */
  async isClosed(): Promise<boolean> {
    return this.isGoneWithin(this.drawer, 10);
  }
}
