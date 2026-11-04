/**
 * The runner's local clock, from an ISO instant and an IANA zone.
 *
 * `packages/nudges` decides whether a prompt may arrive, and it takes local minutes as an input because a pure
 * function does not own a clock. Turning the API's injected instant into the runner's local hour is the app's job -
 * this file and its twin in `apps/api` are the same ten lines because apps do not import from each other, and a
 * shared package for ten lines of `Intl` would be a package for ten lines of `Intl`.
 */
export function localClockOf(iso: string, timezone: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const value = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? "0");
  // `en-GB` can render midnight as 24 in some engines; the day boundary belongs to the next day, so it is 0 here.
  const hour = value("hour") % 24;
  return { hour, minute: value("minute") };
}
