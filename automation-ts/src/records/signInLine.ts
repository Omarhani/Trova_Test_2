import { emit } from '../report/liveEvents';
import { nextStep } from '../report/stepNumbers';

/** how a sign-in was made: the app's own calls, the web app's screens, or the phone app's screens */
export type SignInWay = 'api' | 'screens' | 'app';

const WAY: Readonly<Record<SignInWay, string>> = { api: 'by API', screens: 'by screens', app: "on the app's screens" };

/** "as Admin (by API)" - the user and the way, plus what else happened ("this run's sign-in reused") */
function signInWhat(login: string, way: SignInWay, extra = ''): string {
  return `as ${login.trim()} (${WAY[way]})${extra ? ` - ${extra}` : ''}`;
}

/** Rule 3: every sign-in step names the user and the way - "Sign in as Admin (by API)" */
export function signInLine(login: string, way: SignInWay, extra = ''): string {
  return `Sign in ${signInWhat(login, way, extra)}`;
}

/** session #355: the run's sign-in by what really ran - "Log in programmatically as Ali" / "Sign in on the screen as Ali" */
export function signInDoneLine(login: string, onScreen: boolean): string {
  return onScreen ? `Sign in on the screen as ${login.trim()}` : `Log in programmatically as ${login.trim()}`;
}

type Say = (type: string, fields: Record<string, unknown>) => void;

/** the sign-in as a step of the run page ("Sign in" · "as Ali (on the app's screens)") - a step, never a check */
export function signInStep(login: string, way: SignInWay, extra = '', say: Say = emit): void {
  say('step', { n: nextStep(), a: 'Sign in', e: signInWhat(login, way, extra) });
}

/** writer #357 (check run #210): a sign-in on the screen tells the run its way - the row is named by what ran */
export function screenWayTold(say: Say = emit): void {
  say('way', { way: 'screen' });
}

/** the sign-out as a step of the run page, naming the user ("Sign out" · "Ali - the app closed with its data cleared") */
export function signOutStep(login: string, how: string, say: Say = emit): void {
  say('step', { n: nextStep(), a: 'Sign out', e: `${login.trim()} - ${how}` });
}
