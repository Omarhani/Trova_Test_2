import { webTest as test, param, checkEquals, runRecords } from '../../base/BaseTest';
import { SideMenu } from '../../../src/web/pages/SideMenu';
import { deleteEmployee } from '../employee/employeeSteps';

/** The project's shared clean-up blocks: each deletes only what this run kept under its record key, newest first */

test('deleteEmployeeRecord', async ({ page }) => {
  const userNames = runRecords.newestFirst(param('recordKey', 'employee'));
  test.skip(userNames.length === 0, 'Nothing to delete - the test made no employee in this run');
  console.log('Deleted on the screen - learn the delete call to make it faster');
  for (const userName of userNames) {
    const requests = await new SideMenu(page).openRegistrationRequests();
    const seen = await deleteEmployee(requests, userName, 0);
    checkEquals(`Rows for the employee made by this run after its delete`, seen.rowsAfter, 0);
  }
});
