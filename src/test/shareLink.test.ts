import { describe, expect, it } from "vitest";
import { parseShareParams } from "@/lib/shareLink";

describe("parseShareParams", () => {
  it("returns null for a plain tab hash", () => {
    expect(parseShareParams("#life")).toBeNull();
    expect(parseShareParams("")).toBeNull();
  });

  it("returns null without a valid birth date", () => {
    expect(parseShareParams("#life?le=80")).toBeNull();
    expect(parseShareParams("#life?b=not-a-date&le=80")).toBeNull();
    expect(parseShareParams("#life?b=1993-02-31")).toBeNull();
  });

  it("parses a full prefill", () => {
    const p = parseShareParams(
      "#life?b=1993-06-15&le=80&sl=8&h=Instagram:2.5,Deep%20Work:1.25",
    );
    expect(p).not.toBeNull();
    expect(p!.birthDateInput).toBe("1993-06-15");
    expect(p!.lifeExpectancy).toBe(80);
    expect(p!.sleepHours).toBe(8);
    expect(p!.habits).toHaveLength(2);
    expect(p!.habits[0]).toMatchObject({
      id: "instagram",
      label: "Instagram",
      hoursPerDay: 2.5,
      reclaimHours: 2.5,
    });
    expect(p!.habits[1].label).toBe("Deep Work");
    expect(p!.habits[1].hoursPerDay).toBe(1.25);
  });

  it("clamps out-of-range expectancy and sleep", () => {
    const p = parseShareParams("#life?b=1993-06-15&le=300&sl=1");
    expect(p!.lifeExpectancy).toBe(110);
    expect(p!.sleepHours).toBe(3);
  });

  it("drops malformed, absurd, and duplicate habits", () => {
    const p = parseShareParams(
      "#life?b=1993-06-15&h=Instagram:2.5,instagram:9,NoHours,X:0,Y:-3,Z:99",
    );
    expect(p!.habits).toHaveLength(1);
    expect(p!.habits[0].hoursPerDay).toBe(2.5);
  });

  it("caps the number of shared habits", () => {
    const h = Array.from({ length: 20 }, (_, i) => `App${i}:1`).join(",");
    const p = parseShareParams(`#life?b=1993-06-15&h=${h}`);
    expect(p!.habits.length).toBeLessThanOrEqual(8);
  });
});
