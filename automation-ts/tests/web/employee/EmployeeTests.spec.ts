import { webTest as test, param, checkEquals, checkTrue, caseRecords } from '../../base/BaseTest';
import { PendingRequestsPage } from '../../../src/web/pages/PendingRequestsPage';

/**
 * Employee: one employee goes through the run - added, edited, then deleted on the Registration Requests page.
 * Edit and Delete use the employee Add made (handed as "the employee"); they are skipped when Add did not pass.
 */
test.describe.configure({ mode: 'serial' });

const EMPLOYEE = 'the employee';

test('testAddANewEmployee', async ({ page }) => {
  const employee = {
    firstName: param('employee_first_name', 'Trova'),
    lastName: param('employee_last_name', 'Addcase'),
    userName: param('employee_user_name', 'tc.add.emp+{run}@t2saas.sa'),
    jobNumber: param('employee_job_number', 'TCADD{run}'),
    jobTitle: param('employee_job_title', 'QA'),
  };
  const pendingRequests = await new PendingRequestsPage(page).openRegistrationRequests();
  await pendingRequests.clickAddEmployee();
  await pendingRequests.fillNewEmployee(employee);
  await pendingRequests.clickSave();
  const expectedToast = 'تمت اضافة الموظف بنجاح';
  checkEquals('The toast after saving the new employee', await pendingRequests.toastAfterSave(expectedToast), expectedToast);
  checkTrue('The add employee drawer closes', await pendingRequests.drawerClosed(), 'the drawer is still open');
  caseRecords.madeForAll(EMPLOYEE, employee.userName);
});

test('testEditAnEmployeesData', async ({ page }) => {
  const userName = caseRecords.mine(EMPLOYEE);
  const newFirstName = param('new_first_name', 'Trovaa');
  const newJobTitle = param('new_job_title', 'Senior QA');
  const pendingRequests = await new PendingRequestsPage(page).openRegistrationRequests();
  await pendingRequests.openIncompleteTab();
  await pendingRequests.searchFor(userName);
  await pendingRequests.clickEditEmployee(userName);
  await pendingRequests.changeFirstName(newFirstName);
  await pendingRequests.changeJobTitle(newJobTitle);
  await pendingRequests.clickSave();
  const expectedToast = 'تم تعديل بيانات الموظف بنجاح';
  checkEquals('The toast after saving the edit', await pendingRequests.toastAfterSave(expectedToast), expectedToast);
  checkTrue('The edit employee drawer closes', await pendingRequests.drawerClosed(), 'the drawer is still open');
});

test('testDeleteAnEmployee', async ({ page }) => {
  const userName = caseRecords.mine(EMPLOYEE);
  const pendingRequests = await new PendingRequestsPage(page).openRegistrationRequests();
  await pendingRequests.openIncompleteTab();
  await pendingRequests.searchFor(userName);
  await pendingRequests.clickDeleteOf(userName);
  const expectedQuestion = 'هل أنت متأكد من حذف الطلب ؟';
  checkEquals('The delete confirm message', await pendingRequests.confirmQuestion(), expectedQuestion);
  await pendingRequests.clickOk();
  await pendingRequests.searchFor(userName);
  checkEquals('Rows for the deleted employee after searching again', await pendingRequests.rowsAfterRemoval(userName), 0);
});
