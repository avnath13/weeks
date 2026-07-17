import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeLifeSpan } from "@/lib/timeMath";
import { habitSegments } from "@/lib/gridDraw";
import { buildEquivalences } from "@/lib/equivalences";
import { habitCardText } from "@/lib/shareCard";
import type { SelectedHabit } from "@/lib/habits";

// cssVarHsl reads CSS variables off the document; stub it for node. The
// fallback color path returns a fixed hsl string, which is fine to assert on.
beforeEach(() => {
  vi.stubGlobal("document", { documentElement: {} });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
});

const NOW = new Date(2026, 6, 15).getTime();
const span = computeLifeSpan(
  { birthMs: new Date(1993, 5, 15).getTime(), lifeExpectancy: 80, sleepHours: 8 },
  NOW,
);

const habit = (
  id: string,
  hoursPerDay: number,
  reclaimHours = hoursPerDay,
): SelectedHabit => ({
  id,
  label: id,
  emoji: "📱",
  colorVar: "--event-coral",
  hoursPerDay,
  reclaimHours,
});

describe("habitSegments", () => {
  it("returns no segments without habits", () => {
    expect(habitSegments(span, [], false)).toEqual([]);
  });

  it("paints habit bands from the end of life backwards", () => {
    const segs = habitSegments(span, [habit("scrolling", 4)], false);
    expect(segs).toHaveLength(1);
    const seg = segs[0];
    expect(seg.startWeek + seg.count).toBe(span.totalWeeks);
    expect(seg.count).toBeGreaterThan(0);
    expect(seg.startWeek).toBeGreaterThanOrEqual(span.livedWeeks);
  });

  it("stacks multiple habits without overlapping", () => {
    const segs = habitSegments(
      span,
      [habit("a", 3), habit("b", 2)],
      false,
    );
    expect(segs).toHaveLength(2);
    // Second segment ends exactly where the first begins.
    expect(segs[1].startWeek + segs[1].count).toBe(segs[0].startWeek);
  });

  it("caps total band size at the remaining weeks", () => {
    // 16h/day of a 16h waking day = 100% of remaining waking life.
    const segs = habitSegments(span, [habit("all", 16)], false);
    const total = segs.reduce((s, x) => s + x.count, 0);
    expect(total).toBeLessThanOrEqual(span.remainingWeeks);
  });

  it("adds an emerald reclaim band for the freed weeks in reclaim mode", () => {
    const before = habitSegments(span, [habit("scrolling", 4, 4)], true);
    expect(before).toHaveLength(1); // nothing freed yet

    const after = habitSegments(span, [habit("scrolling", 4, 1)], true);
    expect(after).toHaveLength(2);
    const [shrunk, reclaimed] = after;
    // The reclaimed band covers exactly the difference vs. the original cost.
    const original = habitSegments(span, [habit("scrolling", 4)], false)[0];
    expect(shrunk.count + reclaimed.count).toBe(original.count);
  });

  it("returns no bands on bonus time", () => {
    const bonusSpan = computeLifeSpan(
      { birthMs: new Date(1930, 0, 1).getTime(), lifeExpectancy: 80, sleepHours: 8 },
      NOW,
    );
    expect(bonusSpan.onBonusTime).toBe(true);
    expect(habitSegments(bonusSpan, [habit("a", 4)], false)).toEqual([]);
  });
});

describe("buildEquivalences", () => {
  const cost = (hoursPerDay: number) => ({
    totalHours: hoursPerDay * span.remainingDays,
    weeks: (hoursPerDay * span.remainingDays) / (16 * 7),
    months: 0,
    years: 0,
    percentOfWakingLife: 0,
  });

  it("returns nothing for a negligible habit", () => {
    expect(
      buildEquivalences(
        { totalHours: 10, weeks: 0.1, months: 0, years: 0, percentOfWakingLife: 0 },
        "Chess",
      ),
    ).toEqual([]);
  });

  it("builds all four equivalences for a big habit", () => {
    const eqs = buildEquivalences(cost(4), "Scrolling");
    expect(eqs.length).toBe(4);
    expect(eqs.map((e) => e.text).join(" ")).toMatch(/summers/);
    expect(eqs.map((e) => e.text).join(" ")).toMatch(/books/);
    expect(eqs.map((e) => e.text).join(" ")).toMatch(/movies/);
    expect(eqs.map((e) => e.text).join(" ")).toMatch(/around the world/);
  });

  it("prefixes every line with the habit label", () => {
    for (const eq of buildEquivalences(cost(2), "Instagram")) {
      expect(eq.text.startsWith("Instagram = ")).toBe(true);
    }
  });
});

describe("habitCardText", () => {
  const base = {
    span,
    sleepHours: 8,
    lifeExpectancy: 80,
    reclaimMode: false,
  };

  it("shows the week counter with no habits", () => {
    const t = habitCardText({ ...base, habits: [] });
    expect(t.title).toContain(`of ${span.totalWeeks.toLocaleString()}`);
    expect(t.sub).toContain("remaining");
  });

  it("headlines the biggest habit", () => {
    const t = habitCardText({
      ...base,
      habits: [habit("Commute", 1), habit("Scrolling", 4)],
    });
    expect(t.title).toMatch(/^Scrolling is taking/);
    expect(t.title).toContain("years of the rest of my life");
  });

  it("switches to the reclaim framing in reclaim mode", () => {
    const t = habitCardText({
      ...base,
      reclaimMode: true,
      habits: [habit("Scrolling", 4, 1)],
    });
    expect(t.kicker).toBe("Reclaim mode");
    expect(t.title).toMatch(/taking back [\d,]+ weeks/);
  });
});
