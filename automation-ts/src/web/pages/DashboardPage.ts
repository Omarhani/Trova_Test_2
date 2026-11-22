import { Page } from '@playwright/test';
import { By } from '../by';
import { BasePage } from './base/BasePage';

export class DashboardPage extends BasePage {
  // طلبات التسجيل button (added by Trova's App map)
  readonly button = By.xpath("//a[normalize-space()='طلبات التسجيل' or @aria-label='طلبات التسجيل']");
  constructor(page: Page) { super(page); }
}
