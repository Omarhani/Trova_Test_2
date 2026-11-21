import { By } from '../by';
import { BasePage } from './base/BasePage';
import { PendingRequestsPage } from './PendingRequestsPage';

/** The side menu on every page of the app: opens the pages by their menu names. */
export class SideMenu extends BasePage {
  // --- Locators ---
  private readonly registrationRequestsLink = By.xpath("//a[normalize-space()='طلبات التسجيل' or @aria-label='طلبات التسجيل']");

  // --- Page actions ---
  /** طلبات التسجيل (Registration Requests) - waits for its page */
  async openRegistrationRequests(): Promise<PendingRequestsPage> {
    await this.click(this.registrationRequestsLink, 20, 'طلبات التسجيل');
    const requests = new PendingRequestsPage(this.page);
    await requests.waitUntilShown();
    return requests;
  }
}
