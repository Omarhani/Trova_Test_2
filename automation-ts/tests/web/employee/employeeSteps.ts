import { caseRecords } from '../../base/BaseTest';
import { NewEmployee, PendingRequestsPage } from '../../../src/web/pages/PendingRequestsPage';

/** Expected results of the cases, as the app shows them */
export const ADDED_TOAST = 'تمت اضافة الموظف بنجاح';
export const EDITED_TOAST = 'تم تعديل بيانات الموظف بنجاح';
export const DELETE_QUESTION = 'هل أنت متأكد من حذف الطلب ؟';

/** The employee the Add test makes and hands to the Edit and Delete tests of its chain */
export const EMPLOYEE = 'employee';

/** What the app showed after a Save on the drawer */
export interface SaveSeen {
  toast: string;
  drawerClosed: boolean;
}

/** What the app showed after adding: the save, then the rows the Incomplete tab shows for the new user name */
export interface AddSeen extends SaveSeen {
  rowsFound: number;
}

/** What the app showed after editing: the save, then the values the reopened Edit form holds */
export interface EditSeen extends SaveSeen {
  savedFirstName: string;
  savedJobTitle: string;
}

/** Steps 2-3 of Edit / Delete: the Incomplete tab, then search the user name (Enter) */
async function findInIncomplete(requests: PendingRequestsPage, userName: string): Promise<void> {
  await requests.openIncompleteTab();
  await requests.searchFor(userName);
}

/**
 * Steps 2-9 of "Add a new employee" on the open page; the employee is handed to the tests in handTo right after Save,
 * then the proof: the Incomplete tab finds one row for its user name
 */
export async function addEmployee(requests: PendingRequestsPage, employee: NewEmployee, expectedToast: string, handTo: string[]): Promise<AddSeen> {
  await requests.openAddEmployee();
  await requests.typeFirstName(employee.firstName);
  await requests.typeLastName(employee.lastName);
  await requests.typeUserName(employee.userName);
  await requests.typeJobNumber(employee.jobNumber);
  await requests.selectDepartment(employee.department);
  await requests.typeJobTitle(employee.jobTitle);
  await requests.clickSave();
  handTo.forEach((test) => caseRecords.made(test, EMPLOYEE, employee.userName));
  const toast = await requests.toastAfterSave(expectedToast);
  const drawerClosed = await requests.drawerClosed();
  await findInIncomplete(requests, employee.userName);
  return { toast, drawerClosed, rowsFound: await requests.rowCountBecomes(employee.userName, 1) };
}

/** Steps 2-7 of "Edit an employee's data" on the open page, then the proof: the employee found again and its Edit form read */
export async function editEmployee(requests: PendingRequestsPage, userName: string, newFirstName: string, newJobTitle: string,
                                   expectedToast: string): Promise<EditSeen> {
  await findInIncomplete(requests, userName);
  await requests.openEditEmployee(userName);
  await requests.typeFirstName(newFirstName);
  await requests.typeJobTitle(newJobTitle);
  await requests.clickSave();
  const toast = await requests.toastAfterSave(expectedToast);
  const drawerClosed = await requests.drawerClosed();
  await requests.searchFor(userName);
  await requests.openEditEmployee(userName);
  const savedFirstName = await requests.firstNameBecomes(newFirstName);
  const savedJobTitle = await requests.jobTitleBecomes(newJobTitle);
  await requests.closeDrawer();
  return { toast, drawerClosed, savedFirstName, savedJobTitle };
}

/** What the app showed while deleting */
export interface DeleteSeen {
  confirmMessage: string;
  rowsAfter: number;
}

/** Steps 2-7 of "Delete an employee" on the open page: delete, read the confirm question, OK, search again and count its rows */
export async function deleteEmployee(requests: PendingRequestsPage, userName: string, expectedRows: number): Promise<DeleteSeen> {
  await findInIncomplete(requests, userName);
  await requests.clickDelete(userName);
  const confirmMessage = await requests.confirmMessageText();
  await requests.clickOk();
  await requests.searchFor(userName);
  return { confirmMessage, rowsAfter: await requests.rowCountBecomes(userName, expectedRows) };
}
