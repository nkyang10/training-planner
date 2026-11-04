/**
 * Civil-date arithmetic on `YYYY-MM-DD`, with no clock anywhere.
 *
 * AGENTS rule 1 forbids `Date` inside packages/planner-core, and that rule is not decoration: a plan
 * generated in March has to be reproducible in August when a runner asks why a Tuesday was easy. Dates
 * are therefore strings and arithmetic is integer days since 1970-01-01 (Howard Hinnant's
 * days_from_civil, exact for the whole proleptic Gregorian calendar).
 */
export interface CivilDate {
  y: number;
  m: number;
  d: number;
}

const pad = (value: number, width: number): string => String(value).padStart(width, "0");

export function parseDay(day: string): CivilDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new Error(`not a civil day: ${day}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function formatDay(date: CivilDate): string {
  return `${pad(date.y, 4)}-${pad(date.m, 2)}-${pad(date.d, 2)}`;
}

export function toEpochDay(day: string): number {
  const { y, m, d } = parseDay(day);
  const year = m <= 2 ? y - 1 : y;
  const era = Math.floor(year / 400);
  const yearOfEra = year - era * 400;
  const dayOfYear = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

export function fromEpochDay(epochDay: number): string {
  const z = epochDay + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365);
  const year = yearOfEra + era * 400;
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const mp = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return formatDay({ y: month <= 2 ? year + 1 : year, m: month, d: day });
}

export function addDays(day: string, delta: number): string {
  return fromEpochDay(toEpochDay(day) + delta);
}

export function daysBetween(from: string, to: string): number {
  return toEpochDay(to) - toEpochDay(from);
}

/** Monday = 0 ... Sunday = 6. 1970-01-01 was a Thursday. */
export function weekdayIndex(day: string): number {
  return (((toEpochDay(day) + 3) % 7) + 7) % 7;
}

/** The Monday that starts the day's week; used as the weekly-curve key. */
export function weekStart(day: string): string {
  return fromEpochDay(toEpochDay(day) - weekdayIndex(day));
}

export function eachDay(firstDay: string, lastDay: string): string[] {
  const days: string[] = [];
  for (let epoch = toEpochDay(firstDay); epoch <= toEpochDay(lastDay); epoch += 1) days.push(fromEpochDay(epoch));
  return days;
}
