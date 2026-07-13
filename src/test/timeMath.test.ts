import { describe, expect, it } from "vitest";
import {
  capHabitHours,
  clampLifeExpectancy,
  clampSleepHours,
  computeLifeSpan,
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
    const span = computeLifeSpan(
      { birthMs: birth(30), lifeExpectancy: 80, sleepHours: 8 },
      NOW,
    );
    expect(span.totalWeeks).toBe(Math.round(80 * WEEKS_PER_YEAR));
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
