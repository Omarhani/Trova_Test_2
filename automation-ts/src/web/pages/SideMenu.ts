import { By } from '../by';
import { textIs } from '../xpathText';
import { PendingRequestsTexts } from '../texts/PendingRequestsTexts';
import { BasePage } from './base/BasePage';
import { PendingRequestsPage } from './PendingRequestsPage';

/** The side menu shown on every page of the portal */
export class SideMenu extends BasePage {
  // --- Locators ---
  private readonly registrationRequestsLink = By.xpath(`//a[${textIs(PendingRequestsTexts.menuLink)} or @aria-label='طلبات التسجيل']`);

  /** opens Registration Requests and waits for its heading */
  async openRegistrationRequests(): Promise<PendingRequestsPage> {
    await this.click(this.registrationRequestsLink, 15, 'Registration Requests menu link');
    const page = new PendingRequestsPage(this.page);
    await page.waitShown();
    return page;
  }
}
