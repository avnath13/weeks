import { describe, expect, it } from "vitest";
import {
  capHabitHours,
  clampLifeExpectancy,
  clampSleepHours,
  computeCountdown,
  computeLifeSpan,
  deathMs,
  formatHoursPerDay,
  formatLadder,
  habitCost,
  MS_PER_WEEK,
  parseDateInput,
  reclaimedWeeks,
  validateBirthDate,
  WEEKS_PER_YEAR,
} from "@/lib/timeMath";

const NOW = new Date(2026, 6, 13).getTime(); // 2026-07-13 local

function birth(yearsAgo: number): number {
  return NOW - yearsAgo * WEEKS_PER_YEAR * MS_PER_WEEK;
}

describe("validateBirthDate", () => {
  it("accepts a normal adult birth date", () => {
    expect(validateBirthDate(birth(30), NOW)).toBeNull();
  });
  it("flags empty", () => {
    expect(validateBirthDate(null, NOW)).toBe("empty");
  });
  it("flags future dates", () => {
    expect(validateBirthDate(NOW + MS_PER_WEEK, NOW)).toBe("future");
  });
  it("flags >120 years old", () => {
    expect(validateBirthDate(birth(121), NOW)).toBe("too-old");
  });
  it("accepts born today", () => {
    expect(validateBirthDate(NOW, NOW)).toBeNull();
  });
  it("flags NaN", () => {
    expect(validateBirthDate(Number.NaN, NOW)).toBe("invalid");
  });
});

describe("parseDateInput", () => {
  it("parses a valid date", () => {
    const ms = parseDateInput("1990-06-15");
    expect(ms).not.toBeNull();
    const d = new Date(ms!);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([1990, 5, 15]);
  });
  it("rejects rollover dates like Feb 31", () => {
    expect(parseDateInput("1990-02-31")).toBeNull();
  });
  it("accepts Feb 29 in a leap year, rejects in a non-leap year", () => {
    expect(parseDateInput("2000-02-29")).not.toBeNull();
    expect(parseDateInput("1999-02-29")).toBeNull();
  });
  it("rejects malformed input", () => {
    expect(parseDateInput("banana")).toBeNull();
    expect(parseDateInput("")).toBeNull();
    expect(parseDateInput("1990-6-15")).toBeNull();
  });
});

describe("computeLifeSpan", () => {
  it("computes a 30-year-old with expectancy 80", () => {
    const inputs = { birthMs: birth(30), lifeExpectancy: 80, sleepHours: 8 };
    const span = computeLifeSpan(inputs, NOW);
    // Calendar-exact: total weeks derive from the real death date.
    expect(span.totalWeeks).toBe(
      Math.round((deathMs(inputs) - inputs.birthMs) / MS_PER_WEEK),
    );
    // Sanity: within a week of the 80-year average.
    expect(Math.abs(span.totalWeeks - 80 * WEEKS_PER_YEAR)).toBeLessThan(1.5);
    expect(span.livedWeeks).toBe(Math.floor(30 * WEEKS_PER_YEAR));
    expect(span.remainingWeeks).toBe(span.totalWeeks - span.livedWeeks);
    expect(span.wakingHoursPerDay).toBe(16);
    expect(span.onBonusTime).toBe(false);
    expect(span.percentLived).toBeCloseTo(37.5, 0);
  });

  it("waking weeks scale with sleep", () => {
    const s8 = computeLifeSpan(
      { birthMs: birth(30), lifeExpectancy: 80, sleepHours: 8 },
      NOW,
    );
    const s6 = computeLifeSpan(
      { birthMs: birth(30), lifeExpectancy: 80, sleepHours: 6 },
      NOW,
    );
    expect(s6.remainingWakingWeeks).toBeGreaterThan(s8.remainingWakingWeeks);
    expect(s8.remainingWakingWeeks).toBeCloseTo(s8.remainingWeeks * (16 / 24), 5);
  });

  it("handles a user who outlived their expectancy (bonus time)", () => {
    const span = computeLifeSpan(
      { birthMs: birth(85), lifeExpectancy: 80, sleepHours: 8 },
      NOW,
    );
    expect(span.onBonusTime).toBe(true);
    expect(span.remainingWeeks).toBe(0);
    expect(span.remainingDays).toBe(0);
    expect(span.livedWeeks).toBe(span.totalWeeks);
    expect(span.percentLived).toBe(100);
  });

  it("handles a newborn", () => {
    const span = computeLifeSpan(
      { birthMs: NOW, lifeExpectancy: 80, sleepHours: 8 },
      NOW,
    );
    expect(span.livedWeeks).toBe(0);
    expect(span.currentWeekNumber).toBe(1);
    expect(span.remainingWeeks).toBe(span.totalWeeks);
  });

  it("counts leap days exactly (born 2000-01-01, 4 years = 1461 days)", () => {
    const birthMs = new Date(2000, 0, 1).getTime();
    const death = deathMs({ birthMs, lifeExpectancy: 40, sleepHours: 8 });
    // Wide check via a short window: 2000-01-01 + 4y crosses one leap day.
    const fourYears = new Date(2004, 0, 1).getTime();
    expect(Math.round((fourYears - birthMs) / 86_400_000)).toBe(1461);
    // 40 calendar years from 2000-01-01 is 2040-01-01, with 10 leap days.
    expect(new Date(death).getFullYear()).toBe(2040);
    expect(Math.round((death - birthMs) / 86_400_000)).toBe(40 * 365 + 10);
  });

  it("clamps a Feb 29 birthday to Feb 28 in non-leap target years", () => {
    const birthMs = new Date(2000, 1, 29).getTime();
    const nonLeap = new Date(
      deathMs({ birthMs, lifeExpectancy: 45, sleepHours: 8 }),
    );
    expect([nonLeap.getMonth(), nonLeap.getDate()]).toEqual([1, 28]); // 2045-02-28
    const leap = new Date(
      deathMs({ birthMs, lifeExpectancy: 44, sleepHours: 8 }),
    );
    expect([leap.getMonth(), leap.getDate()]).toEqual([1, 29]); // 2044-02-29
  });

  it("clamps out-of-range expectancy and sleep", () => {
    expect(clampLifeExpectancy(300)).toBe(110);
    expect(clampLifeExpectancy(10)).toBe(40);
    expect(clampLifeExpectancy(Number.NaN)).toBe(80);
    expect(clampSleepHours(20)).toBe(14);
    expect(clampSleepHours(0)).toBe(3);
    expect(clampSleepHours(Number.NaN)).toBe(8);
  });
});

describe("habitCost", () => {
  const span = computeLifeSpan(
    { birthMs: birth(30), lifeExpectancy: 80, sleepHours: 8 },
    NOW,
  );

  it("computes percent as hours / waking hours", () => {
    const cost = habitCost(2.5, span);
    expect(cost.percentOfWakingLife).toBeCloseTo((2.5 / 16) * 100, 5);
  });

  it("total hours = hours/day × remaining days", () => {
    const cost = habitCost(2, span);
    expect(cost.totalHours).toBe(2 * span.remainingDays);
  });

  it("weeks are waking weeks (hours ÷ (waking × 7))", () => {
    const cost = habitCost(2, span);
    expect(cost.weeks).toBeCloseTo((2 * span.remainingDays) / (16 * 7), 5);
    expect(cost.years).toBeCloseTo(cost.weeks / WEEKS_PER_YEAR, 5);
  });

  it("clamps negative and over-waking hours", () => {
    expect(habitCost(-5, span).totalHours).toBe(0);
    expect(habitCost(50, span).percentOfWakingLife).toBe(100);
  });

  it("is all zeros on bonus time", () => {
    const bonus = computeLifeSpan(
      { birthMs: birth(90), lifeExpectancy: 80, sleepHours: 8 },
      NOW,
    );
    const cost = habitCost(3, bonus);
    expect(cost.weeks).toBe(0);
    expect(cost.totalHours).toBe(0);
  });
});

describe("capHabitHours", () => {
  it("passes through when under budget", () => {
    expect(capHabitHours(3, 5, 16)).toEqual({ hours: 3, capped: false });
  });
  it("caps to remaining budget", () => {
    const r = capHabitHours(10, 12, 16);
    expect(r.capped).toBe(true);
    expect(r.hours).toBe(4);
  });
  it("returns 0 when budget exhausted", () => {
    expect(capHabitHours(2, 16, 16).hours).toBe(0);
  });
  it("never rounds the capped value above the budget", () => {
    // budget = 16 - 11.87 = 4.13; rounding to the nearest quarter would
    // give 4.25 > budget. Flooring gives 4.
    const r = capHabitHours(10, 11.87, 16);
    expect(r.capped).toBe(true);
    expect(r.hours).toBeLessThanOrEqual(16 - 11.87);
    expect(r.hours).toBe(4);
  });
});

describe("reclaimedWeeks", () => {
  const span = computeLifeSpan(
    { birthMs: birth(30), lifeExpectancy: 80, sleepHours: 8 },
    NOW,
  );
  it("reclaims the delta", () => {
    const r = reclaimedWeeks(2.5, 1, span);
    expect(r).toBeCloseTo(habitCost(1.5, span).weeks, 5);
  });
  it("never negative when target exceeds current", () => {
    expect(reclaimedWeeks(1, 3, span)).toBe(0);
  });
  it("clamps negative targets", () => {
    expect(reclaimedWeeks(2, -1, span)).toBeCloseTo(
      habitCost(2, span).weeks,
      5,
    );
  });
});

describe("computeCountdown", () => {
  const birthMs = birth(30);
  const span = computeLifeSpan(
    { birthMs, lifeExpectancy: 80, sleepHours: 8 },
    NOW,
  );

  it("counts boxes and days to a future date", () => {
    const target = NOW + 70 * 86_400_000; // 70 days out
    const cd = computeCountdown(target, birthMs, span, NOW);
    expect(cd.past).toBe(false);
    expect(cd.daysUntil).toBe(70);
    expect(cd.boxesUntil).toBe(10);
    expect(cd.startWeek).toBe(span.livedWeeks);
    expect(cd.percentOfRemainingWeeks).toBeCloseTo(
      (10 / span.remainingWeeks) * 100,
      5,
    );
    expect(cd.beyondGrid).toBe(false);
  });

  it("flags past dates", () => {
    const cd = computeCountdown(NOW - 86_400_000, birthMs, span, NOW);
    expect(cd.past).toBe(true);
    expect(cd.daysUntil).toBe(0);
    expect(cd.boxesUntil).toBe(0);
  });

  it("clamps events beyond the grid and flags them", () => {
    const target = NOW + 200 * 365 * 86_400_000;
    const cd = computeCountdown(target, birthMs, span, NOW);
    expect(cd.beyondGrid).toBe(true);
    expect(cd.boxesUntil).toBe(span.remainingWeeks);
  });

  it("handles today (zero boxes, not past)", () => {
    const cd = computeCountdown(NOW + 3_600_000, birthMs, span, NOW);
    expect(cd.past).toBe(false);
    expect(cd.daysUntil).toBe(1);
    expect(cd.boxesUntil).toBeLessThanOrEqual(1);
  });
});

describe("lived/total days", () => {
  it("exposes lived and total day counts", () => {
    const span = computeLifeSpan(
      { birthMs: birth(30), lifeExpectancy: 80, sleepHours: 8 },
      NOW,
    );
    expect(span.livedDays).toBe(Math.floor((NOW - birth(30)) / 86_400_000));
    expect(span.totalDays).toBeGreaterThan(29_000); // ~80y in days
    expect(span.livedDays).toBeLessThan(span.totalDays);
  });
});

describe("formatting", () => {
  it("formats the ladder with thousands separators", () => {
    const span = computeLifeSpan(
      { birthMs: birth(25), lifeExpectancy: 80, sleepHours: 8 },
      NOW,
    );
    const ladder = formatLadder(habitCost(4.5, span));
    expect(ladder.weeks).toMatch(/^\d{1,3}(,\d{3})*$/);
    expect(Number(ladder.percent)).toBeCloseTo((4.5 / 16) * 100, 0);
  });
  it("formats hours per day", () => {
    expect(formatHoursPerDay(2.5)).toBe("2h 30m");
    expect(formatHoursPerDay(0.75)).toBe("45m");
    expect(formatHoursPerDay(3)).toBe("3h");
  });
});
