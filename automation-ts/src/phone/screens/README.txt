The phone app's screens: one screen object per file (SignInScreen.ts, HomeScreen.ts ...), each extending
base/BaseScreen and holding its own locators (AppiumBy.xpath(...)). The app's sign-in screen runs its steps
inside phoneSignInOnce(userName, ...) so a run signs in once per login; it says the sign-in with
signInStep(userName, 'app'). These files are the project's own - Trova's updates never change them.
