import { webTest as test, param, checkEquals, checkContains, checkTrue, caseRecords } from '../../base/BaseTest';
import { SideMenu } from '../../../src/web/pages/SideMenu';
import { addEmployee, ADDED_TOAST, addedEmployeeRows, DELETE_QUESTION, deleteEmployee, EDITED_TOAST, editEmployee, EMPLOYEE,
  savedEdit } from './employeeSteps';

// Edit and Delete use the employee Add made: one chain, a failed Add skips them
test.describe.configure({ mode: 'serial' });

test('testAddANewEmployee', async ({ page }) => {
  const requests = await new SideMenu(page).openRegistrationRequests();
  const employee = {
    firstName: param('employee_first_name', 'Trova'),
    lastName: param('employee_last_name', 'Addcase'),
    userName: param('employee_user_name', 'tc.add.emp+{run}@t2saas.sa'),
    jobNumber: param('employee_job_number', 'TCADD{run}'),
    department: param('employee_department', 'first department in the list'),
    jobTitle: param('employee_job_title', 'QA'),
  };
  const seen = await addEmployee(requests, employee, ADDED_TOAST, ['testEditAnEmployeesData', 'testDeleteAnEmployee']);
  checkTrue('The Add employee drawer closes after Save', seen.drawerClosed);
  checkEquals('The success message after Save', seen.toast, ADDED_TOAST);
  checkEquals('Rows for the new user name in the Incomplete tab', await addedEmployeeRows(requests, employee.userName), 1);
});

test('testEditAnEmployeesData', async ({ page }) => {
  const requests = await new SideMenu(page).openRegistrationRequests();
  const userName = caseRecords.mine(EMPLOYEE);
  const newFirstName = param('new_first_name', 'Trovaa');
  const lastName = param('employee_last_name', 'Addcase');
  const newJobTitle = param('new_job_title', 'Senior QA');
  const seen = await editEmployee(requests, userName, newFirstName, newJobTitle, EDITED_TOAST);
  checkEquals('The success message after Save', seen.toast, EDITED_TOAST);
  checkTrue('The Edit employee drawer closes after Save', seen.drawerClosed);
  const saved = await savedEdit(requests, userName, `${newFirstName} ${lastName}`, newJobTitle);
  checkEquals(`Rows of the user name showing the new name "${newFirstName} ${lastName}"`, saved.rowsWithNewName, 1);
  checkEquals('The job title on the edit form after the save', saved.jobTitle, newJobTitle);
});

test('testDeleteAnEmployee', async ({ page }) => {
  const requests = await new SideMenu(page).openRegistrationRequests();
  const userName = caseRecords.mine(EMPLOYEE);
  const seen = await deleteEmployee(requests, userName, 0);
  checkContains('The delete confirm question', seen.confirmMessage, DELETE_QUESTION);
  checkEquals('Rows for the user name after the delete and a new search', seen.rowsAfter, 0);
});
