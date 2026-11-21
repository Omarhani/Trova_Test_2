/** the "Opened the app signed in as ..." line every case shows once the app is proved signed in */
export function openedLine(login: string): string {
  return `Opened the app signed in as ${login}`;
}

/** what the sign-in test's open stands on: how it signed in, its check line, its picture */
export interface OpenShownDeps {
  /** the run's sign-in was made on the sign-in screen */
  onScreen: () => boolean;
  check: (text: string) => void;
  picture: () => Promise<void>;
}

/**
 * A writer's check: the sign-in test opens the run's browser signed in; its steps said the same thing twice
 * ("Opened the app signed in as X" and the sign-in test's own "... as X") and it had no picture. The open's own line is
 * left out (the sign-in test says it once), and the picture of the app after the sign-in is kept. A sign-in made on the
 * screen keeps its line as before.
 */
export async function openShown(login: string, open: (proved: (login: string) => void) => Promise<void>, d: OpenShownDeps): Promise<void> {
  await open(() => undefined);
  if (d.onScreen()) d.check(openedLine(login));
  await d.picture();
}
