Tests by kind, then one folder per feature: tests/web/<feature>/, tests/mobile/<feature>/, tests/api/<feature>/,
tests/hybrid/<feature>/ (web + phone) - each <Feature>Tests.spec.ts holds steps from page methods and named checks only.
Shared parts live in tests/base (BaseTest.ts, BaseApi.ts); the project's one sign-in block is tests/api/signIn/logIn.spec.ts.
