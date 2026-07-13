/**
 * Core time math for Weeks. All functions are pure so they can be unit-tested.
 *
 * Conventions:
 * - "now" is always passed in explicitly (testability; avoids frozen-Date bugs).
 * - Weeks are exact 7-day spans measured in ms; leap years fall out naturally.
 * - All habit conversions are denominated in WAKING time (24h − sleep).
 */

export const MS_PER_DAY = 86_400_000;
export const MS_PER_WEEK = MS_PER_DAY * 7;
export const WEEKS_PER_MONTH = 4.345;
export const WEEKS_PER_YEAR = 52.1775;

export const LIFE_EXPECTANCY_MIN = 40;
export const LIFE_EXPECTANCY_MAX = 110;
export const LIFE_EXPECTANCY_DEFAULT = 80;
export const SLEEP_MIN = 3;
export const SLEEP_MAX = 14;
export const SLEEP_DEFAULT = 8;
export const MAX_AGE_YEARS = 120;

export interface LifeInputs {
  /** Milliseconds since epoch of the user's birth date (local midnight). */
  birthMs: number;
  /** Expected lifespan in years. */
  lifeExpectancy: number;
  /** Average hours of sleep per night. */
  sleepHours: number;
}

export interface LifeSpan {
  totalWeeks: number;
  livedWeeks: number;
  remainingWeeks: number;
  remainingDays: number;
  /** remainingWeeks scaled by the waking fraction. */
  remainingWakingWeeks: number;
  wakingHoursPerDay: number;
  currentWeekNumber: number;
  /** True when the user has outlived their configured expectancy. */
  onBonusTime: boolean;
  percentLived: number;
}

export type BirthDateIssue =
  | "empty"
  | "invalid"
  | "future"
  | "too-old";

/** Validate a birth date; returns null when acceptable. */
export function validateBirthDate(
  birthMs: number | null,
  now: number,
): BirthDateIssue | null {
  if (birthMs === null) return "empty";
  if (!Number.isFinite(birthMs)) return "invalid";
  if (birthMs > now) return "future";
  if (now - birthMs > MAX_AGE_YEARS * WEEKS_PER_YEAR * MS_PER_WEEK)
    return "too-old";
  return null;
}

export function clampLifeExpectancy(years: number): number {
  if (!Number.isFinite(years)) return LIFE_EXPECTANCY_DEFAULT;
  return Math.min(LIFE_EXPECTANCY_MAX, Math.max(LIFE_EXPECTANCY_MIN, years));
}

export function clampSleepHours(hours: number): number {
  if (!Number.isFinite(hours)) return SLEEP_DEFAULT;
  return Math.min(SLEEP_MAX, Math.max(SLEEP_MIN, hours));
}

/** Death moment: birth + lifeExpectancy years (in exact week-scaled ms). */
export function deathMs(inputs: LifeInputs): number {
  return (
    inputs.birthMs +
    clampLifeExpectancy(inputs.lifeExpectancy) * WEEKS_PER_YEAR * MS_PER_WEEK
  );
}

export function computeLifeSpan(inputs: LifeInputs, now: number): LifeSpan {
  const sleep = clampSleepHours(inputs.sleepHours);
  const wakingHoursPerDay = 24 - sleep;
  const death = deathMs(inputs);

  const totalWeeks = Math.max(
    1,
    Math.round((death - inputs.birthMs) / MS_PER_WEEK),
  );
  const livedWeeksRaw = Math.floor((now - inputs.birthMs) / MS_PER_WEEK);
  const livedWeeks = Math.min(totalWeeks, Math.max(0, livedWeeksRaw));
  const remainingWeeks = Math.max(0, totalWeeks - livedWeeks);
  const remainingDays = Math.max(0, Math.floor((death - now) / MS_PER_DAY));
  const onBonusTime = now >= death;

  return {
    totalWeeks,
    livedWeeks,
    remainingWeeks,
    remainingDays,
    remainingWakingWeeks: remainingWeeks * (wakingHoursPerDay / 24),
    wakingHoursPerDay,
    currentWeekNumber: Math.min(totalWeeks, livedWeeks + 1),
    onBonusTime,
    percentLived: Math.min(100, (livedWeeks / totalWeeks) * 100),
  };
}

export interface HabitCost {
  /** Total hours this habit consumes over the remaining life. */
  totalHours: number;
  /** Whole waking weeks consumed (the grid unit). */
  weeks: number;
  months: number;
  years: number;
  /** Share of remaining waking time, 0–100. */
  percentOfWakingLife: number;
}

/**
 * Convert an hours-per-day habit into weeks/months/years of remaining WAKING
 * life. A "week" here is a waking week: 7 × wakingHoursPerDay hours.
 */
export function habitCost(
  hoursPerDay: number,
  span: LifeSpan,
): HabitCost {
  const safeHours = Math.max(0, Math.min(hoursPerDay, span.wakingHoursPerDay));
  const totalHours = safeHours * span.remainingDays;
  const wakingWeekHours = span.wakingHoursPerDay * 7;
  const weeks = wakingWeekHours > 0 ? totalHours / wakingWeekHours : 0;
  return {
    totalHours,
    weeks,
    months: weeks / WEEKS_PER_MONTH,
    years: weeks / WEEKS_PER_YEAR,
    percentOfWakingLife:
      span.wakingHoursPerDay > 0
        ? (safeHours / span.wakingHoursPerDay) * 100
        : 0,
  };
}

/**
 * Cap a set of habit hours so their sum never exceeds the waking day.
 * Returns the adjusted hours for the habit being edited (last writer loses).
 */
export function capHabitHours(
  requestedHours: number,
  otherHabitsTotal: number,
  wakingHoursPerDay: number,
): { hours: number; capped: boolean } {
  const budget = Math.max(0, wakingHoursPerDay - otherHabitsTotal);
  if (requestedHours <= budget) return { hours: requestedHours, capped: false };
  return { hours: Math.round(budget * 4) / 4, capped: true };
}

/** Weeks reclaimed by reducing a habit from `fromHours` to `toHours` per day. */
export function reclaimedWeeks(
  fromHours: number,
  toHours: number,
  span: LifeSpan,
): number {
  const delta = Math.max(0, fromHours - Math.max(0, toHours));
  return habitCost(delta, span).weeks;
}

export interface UnitLadder {
  weeks: string;
  months: string;
  years: string;
  percent: string;
}

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Human-readable unit ladder for a habit cost. */
export function formatLadder(cost: HabitCost): UnitLadder {
  return {
    weeks: fmt(Math.round(cost.weeks)),
    months: fmt(cost.months, cost.months < 10 ? 1 : 0),
    years: fmt(cost.years, cost.years < 10 ? 1 : 0),
    percent: fmt(cost.percentOfWakingLife, 1),
  };
}

export function formatHoursPerDay(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** Parse a YYYY-MM-DD date-input value to local-midnight ms, or null. */
export function parseDateInput(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  // Reject rollover (e.g. Feb 31 → Mar 3).
  if (
    date.getFullYear() !== Number(y) ||
    date.getMonth() !== Number(mo) - 1 ||
    date.getDate() !== Number(d)
  )
    return null;
  return date.getTime();
}
