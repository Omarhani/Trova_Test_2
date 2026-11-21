import { webTest as test, param, checkEquals, checkTrue, caseRecords } from '../../base/BaseTest';
import { SideMenu } from '../../../src/web/pages/SideMenu';

/** Employee: add a new employee from Registration Requests, then edit it and delete it - one employee through the run. */
test.describe.configure({ mode: 'serial' });

const EMPLOYEE = 'the employee';

test('testAddANewEmployee', async ({ page }) => {
  const employeeUserName = param('employee_user_name', 'tc.add.emp+{run:692}@t2saas.sa');
  const requests = await new SideMenu(page).openRegistrationRequests();
  const drawer = await requests.addEmployee({
    firstName: param('employee_first_name', 'Trova'),
    lastName: param('employee_last_name', 'Addcase'),
    userName: employeeUserName,
    jobNumber: param('employee_job_number', 'TCADD{run:692}'),
    jobTitle: param('employee_job_title', 'QA'),
  });
  await drawer.save();
  checkEquals('The success message after saving', await requests.toastAfterSave('تمت اضافة الموظف بنجاح'), 'تمت اضافة الموظف بنجاح');
  checkTrue('The add employee drawer closes', await drawer.isClosed(), 'the drawer was still open after 10 s');
  caseRecords.madeForAll(EMPLOYEE, employeeUserName);
});

test('testEditAnEmployeesData', async ({ page }) => {
  const employeeUserName = caseRecords.mine(EMPLOYEE);
  const requests = await new SideMenu(page).openRegistrationRequests();
  await requests.openIncompleteTab();
  await requests.searchFor(employeeUserName);
  const drawer = await requests.openEditEmployee(employeeUserName);
  await drawer.changeFirstName(param('new_first_name', 'Trovaa'));
  await drawer.changeJobTitle(param('new_job_title', 'Senior QA'));
  await drawer.save();
  checkEquals('The success message after saving', await requests.toastAfterSave('تم تعديل بيانات الموظف بنجاح'), 'تم تعديل بيانات الموظف بنجاح');
  checkTrue('The edit employee drawer closes', await drawer.isClosed(), 'the drawer was still open after 10 s');
});

test('testDeleteAnEmployee', async ({ page }) => {
  const employeeUserName = caseRecords.mine(EMPLOYEE);
  const requests = await new SideMenu(page).openRegistrationRequests();
  await requests.openIncompleteTab();
  await requests.searchFor(employeeUserName);
  await requests.clickDeleteOn(employeeUserName);
  checkEquals('The confirm message', await requests.confirmMessageText(), 'هل أنت متأكد من حذف الطلب ؟');
  await requests.confirmOk();
  await requests.searchFor(employeeUserName);
  checkEquals('Rows of the deleted user name after the search', await requests.rowsOfBecome(employeeUserName, 0), 0);
});
