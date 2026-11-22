import { BasePage } from './base/BasePage';
import { By } from '../by';
import { PendingRequestsPage } from './PendingRequestsPage';

/** The side menu shown on every page of the portal: each item opens its page and gives it back. */
export class SideMenu extends BasePage {
  // --- Locators ---
  private readonly registrationRequestsLink = By.xpath("//a[normalize-space()='طلبات التسجيل' or @aria-label='طلبات التسجيل']");

  // --- Page actions ---
  /** opens طلبات التسجيل (Registration Requests) and waits until its page shows */
  async openRegistrationRequests(): Promise<PendingRequestsPage> {
    await this.click(this.registrationRequestsLink, 20, 'طلبات التسجيل (Registration Requests)');
    const page = new PendingRequestsPage(this.page);
    await page.waitUntilShown();
    return page;
  }
}
