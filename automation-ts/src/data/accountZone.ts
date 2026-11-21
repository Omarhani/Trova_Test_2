/**
 * The account's time zone in minutes east of UTC: the one the run states (TROVA_TIME_ZONE_OFFSET_MIN), else this
 * computer's own. The phone app's headers and body envelope come from the sign-in recipe's call shape, never from code.
 */
export function accountOffsetMin(env: NodeJS.ProcessEnv = process.env, computerOffset = () => new Date().getTimezoneOffset()): number {
  const stated = Number(env.TROVA_TIME_ZONE_OFFSET_MIN?.trim());
  return env.TROVA_TIME_ZONE_OFFSET_MIN?.trim() && Number.isFinite(stated) ? stated : -computerOffset();
}
