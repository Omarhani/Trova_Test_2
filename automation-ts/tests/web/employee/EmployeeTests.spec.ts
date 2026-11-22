import { webTest as test, param, checkEquals, checkContains, checkTrue, caseRecords } from '../../base/BaseTest';
import { SideMenu } from '../../../src/web/pages/SideMenu';

/**
 * Employee 5 - one employee through its life on Registration Requests: added, edited, then deleted. The add test hands
 * the new employee's user name to the edit and delete tests (caseRecords); the delete test removes it and checks it is gone.
 */
test.describe.configure({ mode: 'serial' });

const EMPLOYEE = 'employee';
const ADDED_TOAST = 'تمت اضافة الموظف بنجاح';
const EDITED_TOAST = 'تم تعديل بيانات الموظف بنجاح';
const DELETE_QUESTION = 'هل أنت متأكد من حذف الطلب';

test('testAddANewEmployee', async ({ page }) => {
  const employee = {
    firstName: param('employee_first_name', 'Trova'),
    lastName: param('employee_last_name', 'Addcase'),
    userName: param('employee_user_name', 'tc.add.emp+{run}@t2saas.sa'),
    jobNumber: param('employee_job_number', 'TCADD{run}'),
    department: param('employee_department', 'first department in the list'),
    jobTitle: param('employee_job_title', 'QA'),
  };
  const requests = await new SideMenu(page).openRegistrationRequests();
  const drawer = await requests.clickAddEmployee();
  await drawer.fillNewEmployee(employee);
  await drawer.clickSave();
  const toast = await drawer.toastAfterSave(ADDED_TOAST);
  const closed = await drawer.isClosed();
  if (closed) caseRecords.madeForAll(EMPLOYEE, employee.userName); // saved: the edit and delete tests use it
  checkTrue('The add employee drawer closes after Save', closed, toast);
  checkEquals('Toast after adding the employee', toast, ADDED_TOAST);
});

test('testEditAnEmployeesData', async ({ page }) => {
  const userName = caseRecords.mine(EMPLOYEE);
  const newFirstName = param('new_first_name', 'Trovaa');
  const newJobTitle = param('new_job_title', 'Senior QA');
  const requests = await new SideMenu(page).openRegistrationRequests();
  await requests.openIncompleteTab();
  await requests.searchFor(userName);
  const drawer = await requests.clickEditEmployee(userName);
  await drawer.changeFirstName(newFirstName);
  await drawer.changeJobTitle(newJobTitle);
  await drawer.clickSave();
  checkEquals('Toast after saving the edit', await drawer.toastAfterSave(EDITED_TOAST), EDITED_TOAST);
  checkTrue('The edit employee drawer closes after Save', await drawer.isClosed());
});

test('testDeleteAnEmployee', async ({ page }) => {
  const userName = caseRecords.mine(EMPLOYEE);
  const requests = await new SideMenu(page).openRegistrationRequests();
  await requests.openIncompleteTab();
  await requests.searchFor(userName);
  await requests.clickDeleteOf(userName);
  checkContains('Confirm message before deleting', await requests.confirmQuestionText(), DELETE_QUESTION);
  await requests.clickOk();
  await requests.searchFor(userName);
  checkEquals('Rows of the deleted employee after searching its user name', await requests.rowsAfterRemoval(userName), 0);
});
