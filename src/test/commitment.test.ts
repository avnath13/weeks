import { describe, expect, it } from "vitest";
import { commitmentProgress, formatBanked } from "@/lib/commitment";
import { computeLifeSpan, MS_PER_DAY } from "@/lib/timeMath";

const NOW = new Date(2026, 6, 15).getTime(); // 2026-07-15 local
const span = computeLifeSpan(
  {
    birthMs: new Date(1993, 5, 15).getTime(),
    lifeExpectancy: 80,
    sleepHours: 8, // 16 waking hours -> 112h waking week
  },
  NOW,
);

const COMMITMENT = {
  startedAt: "2026-07-01",
  targets: [
    {
      id: "instagram",
      label: "Instagram",
      emoji: "📸",
      colorVar: "--event-rose",
      fromHours: 2.5,
      toHours: 1,
    },
  ],
};

describe("commitmentProgress", () => {
  it("banks nothing before any check-in", () => {
    const p = commitmentProgress(COMMITMENT, [], span, NOW);
    expect(p.checkInCount).toBe(0);
    expect(p.totalWeeksBanked).toBe(0);
    expect(p.targets[0].latestHours).toBeNull();
    expect(p.targets[0].onTrack).toBeNull();
    expect(p.daysSinceStart).toBe(14);
  });

  it("banks saved hours from a check-in until now", () => {
    // Check-in on 07-05 says 1h/day; 10 days until 07-15 at 1.5h/day saved
    // = 15h = 15/112 waking weeks.
    const p = commitmentProgress(
      COMMITMENT,
      [{ date: "2026-07-05", hours: { instagram: 1 } }],
      span,
      NOW,
    );
    expect(p.targets[0].latestHours).toBe(1);
    expect(p.targets[0].onTrack).toBe(true);
    expect(p.totalWeeksBanked).toBeCloseTo(15 / 112, 5);
  });

  it("uses each check-in's rate until the next one", () => {
    // 07-05 -> 07-10 at 2h (0.5 saved x 5d), 07-10 -> 07-15 at 1h (1.5 x 5d)
    const p = commitmentProgress(
      COMMITMENT,
      [
        { date: "2026-07-10", hours: { instagram: 1 } },
        { date: "2026-07-05", hours: { instagram: 2 } },
      ],
      span,
      NOW,
    );
    expect(p.totalWeeksBanked).toBeCloseTo((0.5 * 5 + 1.5 * 5) / 112, 5);
    expect(p.targets[0].latestHours).toBe(1);
  });

  it("never banks negative time when usage went up", () => {
    const p = commitmentProgress(
      COMMITMENT,
      [{ date: "2026-07-05", hours: { instagram: 4 } }],
      span,
      NOW,
    );
    expect(p.totalWeeksBanked).toBe(0);
    expect(p.targets[0].onTrack).toBe(false);
  });

  it("ignores check-ins for habits outside the commitment", () => {
    const p = commitmentProgress(
      COMMITMENT,
      [{ date: "2026-07-05", hours: { tiktok: 0 } }],
      span,
      NOW,
    );
    expect(p.targets[0].latestHours).toBeNull();
    expect(p.totalWeeksBanked).toBe(0);
  });

  it("clips a pre-commitment check-in to the start date", () => {
    const p = commitmentProgress(
      COMMITMENT,
      [{ date: "2026-06-20", hours: { instagram: 1 } }],
      span,
      NOW,
    );
    // Only the 14 days since startedAt count, not the 25 since the check-in.
    expect(p.totalWeeksBanked).toBeCloseTo((1.5 * 14) / 112, 5);
  });
});

describe("formatBanked", () => {
  const weeks = (days: number) => days / 7;
  it("formats sub-day amounts in hours", () => {
    expect(formatBanked(weeks(0.5))).toBe("12h");
    expect(formatBanked(weeks(1 / 48))).toBe("under an hour");
  });
  it("formats 1-7 days in days", () => {
    expect(formatBanked(weeks(3))).toBe("3.0 days");
  });
  it("formats a week and up in weeks", () => {
    expect(formatBanked(2.25)).toBe("2.3 weeks");
  });
});

describe("day math sanity", () => {
  it("MS_PER_DAY matches Date arithmetic across the test window", () => {
    expect(
      (new Date(2026, 6, 15).getTime() - new Date(2026, 6, 1).getTime()) /
        MS_PER_DAY,
    ).toBe(14);
  });
});
