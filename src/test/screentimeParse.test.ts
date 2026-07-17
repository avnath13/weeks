import { describe, expect, it } from "vitest";
import {
  parseScreenTimeText,
  toHoursPerDay,
} from "@/lib/screentimeParse";

const IOS_WEEKLY = `
SCREEN TIME
Daily Average
4h 47m

MOST USED
Instagram
14h 32m
TikTok
11h 8m
Safari
6h 45m
Messages
3h 12m
`;

const IOS_DAILY = `
Screen Time
Today
Updated today at 9:41 PM
5h 12m

MOST USED
Instagram
2h 4m
YouTube
1h 38m
Safari
55m
`;

const ANDROID_DAILY = `
Digital Wellbeing
Dashboard
Today
5 hr, 2 min

Instagram
2 hr, 14 min
Chrome
1 hr, 3 min
WhatsApp
45 min
`;

const GARBLED = `
lnstagram
2h 14m
T1kTok
1h 38m
`;

describe("parseScreenTimeText - iOS weekly view", () => {
  const result = parseScreenTimeText(IOS_WEEKLY);

  it("detects weekly confidently from the Daily Average headline", () => {
    expect(result.guessedPeriod).toBe("week");
    expect(result.periodConfident).toBe(true);
  });

  it("finds all four apps with correct durations", () => {
    expect(result.apps).toHaveLength(4);
    const insta = result.apps.find((a) => a.appId === "instagram");
    expect(insta?.hoursInPeriod).toBeCloseTo(14 + 32 / 60, 3);
    const tiktok = result.apps.find((a) => a.appId === "tiktok");
    expect(tiktok?.hoursInPeriod).toBeCloseTo(11 + 8 / 60, 3);
  });

  it("does not treat the Daily Average headline as an app", () => {
    expect(
      result.apps.some((a) => /average|screen time|most used/i.test(a.label)),
    ).toBe(false);
  });
});

describe("parseScreenTimeText - iOS daily view", () => {
  const result = parseScreenTimeText(IOS_DAILY);
  it("detects daily period from 'Today'", () => {
    expect(result.guessedPeriod).toBe("day");
    expect(result.periodConfident).toBe(true);
  });
  it("parses minutes-only durations", () => {
    const safari = result.apps.find((a) => a.appId === "safari");
    expect(safari?.hoursInPeriod).toBeCloseTo(55 / 60, 3);
  });
});

describe("parseScreenTimeText - Android Digital Wellbeing", () => {
  const result = parseScreenTimeText(ANDROID_DAILY);
  it("detects daily period", () => {
    expect(result.guessedPeriod).toBe("day");
  });
  it("parses 'X hr, Y min' format", () => {
    const insta = result.apps.find((a) => a.appId === "instagram");
    expect(insta?.hoursInPeriod).toBeCloseTo(2 + 14 / 60, 3);
    const whatsapp = result.apps.find((a) => a.appId === "whatsapp");
    expect(whatsapp?.hoursInPeriod).toBeCloseTo(0.75, 3);
  });
});

describe("parseScreenTimeText - OCR noise", () => {
  it("snaps garbled app names to the dictionary", () => {
    const result = parseScreenTimeText(GARBLED);
    expect(result.apps.find((a) => a.appId === "instagram")).toBeTruthy();
    expect(result.apps.find((a) => a.appId === "tiktok")).toBeTruthy();
  });

  it("returns empty for text with no durations", () => {
    const result = parseScreenTimeText("hello world\nnothing here");
    expect(result.apps).toHaveLength(0);
  });

  it("returns empty for empty input", () => {
    expect(parseScreenTimeText("").apps).toHaveLength(0);
  });

  it("dedupes repeated apps", () => {
    const result = parseScreenTimeText("Instagram\n2h 4m\nInstagram\n1h 2m");
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].hoursInPeriod).toBeCloseTo(2 + 4 / 60, 3);
  });

  it("keeps unknown apps with a cleaned label", () => {
    const result = parseScreenTimeText("Duolingo\n1h 12m");
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].appId).toBeNull();
    expect(result.apps[0].label).toBe("Duolingo");
  });

  it("rejects absurd durations", () => {
    const result = parseScreenTimeText("Instagram\n999h 30m");
    expect(result.apps).toHaveLength(0);
  });

  it("falls back to magnitude heuristic without period markers", () => {
    const weekly = parseScreenTimeText("Instagram\n14h 30m");
    expect(weekly.guessedPeriod).toBe("week");
    expect(weekly.periodConfident).toBe(false);
    const daily = parseScreenTimeText("Instagram\n2h 30m");
    expect(daily.guessedPeriod).toBe("day");
  });

  it("does not treat bare Day/Week selector chrome as a weekly marker", () => {
    // A Day-view screenshot whose tab strip reads "This Week": the mere
    // presence of week words must NOT flip the period to weekly (which
    // would silently divide every duration by 7).
    const result = parseScreenTimeText(
      "Screen Time\nThis Week\nToday\n2 hr, 5 min\nMost Used\nInstagram\n2h 5m",
    );
    expect(result.guessedPeriod).toBe("day");
  });

  it("still detects weekly from the Daily Average headline alone", () => {
    const result = parseScreenTimeText(
      "Daily Average\n2 hr, 4 min\nMost Used\nInstagram\n14h 30m",
    );
    expect(result.guessedPeriod).toBe("week");
    expect(result.periodConfident).toBe(true);
  });
});

// The real iOS Week view a user reported: a Limits section (app time LIMITS,
// not usage) sits ABOVE the Most Used list. Only Most Used is real usage.
const IOS_REAL_WEEK = `
21:28
AV's i17proMax
Devices
Week
Day
Screen Time
Daily Average
5h 11m
35% from last week
S M T W T F S
Social
5h 57m
Productivity & Finance
1h 6m
Other
24m
Total Screen Time
10h 23m
Updated today at 20:54
Limits
Instagram
30 min
com.apple.helpviewer
2 min
Most Used
Show Categories
Instagram
4h 9m
LinkedIn
52m
WhatsApp
42m
Gmail
34m
`;

describe("parseScreenTimeText - real iOS week view with Limits section", () => {
  const result = parseScreenTimeText(IOS_REAL_WEEK);

  it("reads usage from Most Used, not the Limits section", () => {
    const insta = result.apps.find((a) => a.appId === "instagram");
    // 4h 9m from Most Used, NOT the 30 min limit.
    expect(insta?.hoursInPeriod).toBeCloseTo(4 + 9 / 60, 2);
  });

  it("ignores category summaries and totals as apps", () => {
    expect(
      result.apps.some((a) =>
        /social|productivity|other|total|screen time|average/i.test(a.label),
      ),
    ).toBe(false);
  });

  it("never surfaces com.apple.helpviewer (bundle-id, Limits-only)", () => {
    expect(result.apps.some((a) => /helpviewer/i.test(a.label))).toBe(false);
  });

  it("captures the four real apps", () => {
    const ids = result.apps.map((a) => a.appId ?? a.label);
    expect(ids).toContain("instagram");
    expect(ids).toContain("whatsapp");
    expect(result.apps.find((a) => a.appId === "whatsapp")?.hoursInPeriod).toBeCloseTo(
      42 / 60,
      3,
    );
  });

  it("detects the week period confidently", () => {
    expect(result.guessedPeriod).toBe("week");
    expect(result.periodConfident).toBe(true);
  });

  it("end-to-end: WhatsApp 42m/week converts to 6m/day", () => {
    const whatsapp = result.apps.find((a) => a.appId === "whatsapp")!;
    expect(
      Math.round(toHoursPerDay(whatsapp.hoursInPeriod, result.guessedPeriod) * 60),
    ).toBe(6);
  });
});

describe("parseScreenTimeText - period sanity", () => {
  it("overrides an explicit 'today' when a single app exceeds 16h", () => {
    const result = parseScreenTimeText("Today\nMOST USED\nInstagram\n22h 10m");
    expect(result.guessedPeriod).toBe("week");
    expect(result.periodConfident).toBe(false);
  });

  it("drops bundle-id noise like com.apple.helpviewer", () => {
    const result = parseScreenTimeText(
      "Instagram\n2h 4m\ncom.apple.helpviewer\n1h 2m",
    );
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].appId).toBe("instagram");
  });
});

describe("toHoursPerDay", () => {
  it("divides weekly totals by 7 at minute precision", () => {
    expect(toHoursPerDay(14, "week")).toBe(2);
    expect(toHoursPerDay(14.5, "week")).toBeCloseTo(2 + 4 / 60, 5); // 124 min
    expect(toHoursPerDay(2.6, "day")).toBeCloseTo(2.6, 5); // 2h 36m exact
  });

  it("42m/week comes out as exactly 6m/day", () => {
    expect(toHoursPerDay(42 / 60, "week")).toBeCloseTo(6 / 60, 5);
  });

  it("floors small nonzero values at 1 minute instead of 0", () => {
    expect(toHoursPerDay(3 / 60, "week")).toBeCloseTo(1 / 60, 5);
    expect(toHoursPerDay(0, "week")).toBe(0);
  });
});

describe("parseScreenTimeText - iOS rows with category subtitles", () => {
  const WITH_CATEGORIES = `
MOST USED
Instagram
Social
14h 32m
YouTube
Entertainment
8h 5m
Slack
Productivity & Finance
3h 40m
Duolingo
Education
1h 12m
Safari
Information & Reading
55m
`;

  it("pairs durations with the app name two lines up, skipping the category", () => {
    const result = parseScreenTimeText(WITH_CATEGORIES);
    expect(result.apps).toHaveLength(5);
    expect(result.apps.find((a) => a.appId === "instagram")?.hoursInPeriod).toBeCloseTo(
      14 + 32 / 60,
      3,
    );
    expect(result.apps.find((a) => a.appId === "youtube")).toBeTruthy();
    expect(result.apps.find((a) => a.appId === "slack")).toBeTruthy();
    expect(result.apps.find((a) => a.label === "Duolingo")).toBeTruthy();
    expect(result.apps.find((a) => a.appId === "safari")).toBeTruthy();
  });

  it("never emits a category as an app name", () => {
    const result = parseScreenTimeText(WITH_CATEGORIES);
    expect(
      result.apps.some((a) => /social|entertainment|education|productivity/i.test(a.label)),
    ).toBe(false);
  });
});

describe("parseScreenTimeText - OCR digit/unit confusions", () => {
  it("reads l4h as 14h and rn as m", () => {
    const result = parseScreenTimeText("Instagram\nl4h 32rn");
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].hoursInPeriod).toBeCloseTo(14 + 32 / 60, 3);
  });
});
