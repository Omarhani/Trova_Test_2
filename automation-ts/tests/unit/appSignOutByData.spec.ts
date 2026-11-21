import { expect, test } from '@playwright/test';
import { signOutByClearing } from '../../src/phone/phoneReset';

/**
 * the clean-up signs
 * the app out without its screens - the app closed and its data cleared (no user kept on the phone) - then proves it:
 * the app is not running and holds nothing.
 */
test('the app is closed and its data cleared in two calls, then its state is read: not running = signed out', async () => {
  const calls: string[] = [];
  const call = async (command: string, args: Record<string, unknown>) => {
    calls.push(`${command} ${String(args.appId ?? args.bundleId)}`);
    return command === 'mobile: queryAppState' ? 1 : undefined;
  };
  expect(await signOutByClearing(call, 'com.example.app')).toBe(true);
  // clearing the data took the app's permissions too - the next sign-in met Android's location question
  expect(calls).toEqual(['mobile: terminateApp com.example.app', 'mobile: clearApp com.example.app', 'mobile: changePermissions undefined', 'mobile: queryAppState com.example.app']);
});

test('trap: an app still running after the clear is not called signed out', async () => {
  const call = async (command: string) => (command === 'mobile: queryAppState' ? 4 : undefined);
  expect(await signOutByClearing(call, 'com.example.app')).toBe(false);
});
