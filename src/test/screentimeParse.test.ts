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

  it("guesses weekly from magnitude, flagged as a guess (Daily Average is ambiguous)", () => {
    expect(result.guessedPeriod).toBe("week");
    expect(result.periodConfident).toBe(false);
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
});

describe("parseScreenTimeText - Day/Week header selector", () => {
  it("'Week' at the top forces weekly, even with small values", () => {
    const result = parseScreenTimeText(
      "Week\nSCREEN TIME\nMOST USED\nWhatsApp\n42m\nMail\n21m",
    );
    expect(result.guessedPeriod).toBe("week");
    expect(result.periodConfident).toBe(true);
  });

  it("'Day' at the top forces daily, even with large values", () => {
    const result = parseScreenTimeText(
      "Day\nSCREEN TIME\nMOST USED\nInstagram\n6h 12m",
    );
    expect(result.guessedPeriod).toBe("day");
    expect(result.periodConfident).toBe(true);
  });

  it("'Week' wins when the segmented control shows both Day and Week", () => {
    const result = parseScreenTimeText(
      "Day Week\nMOST USED\nInstagram\n14h 30m",
    );
    expect(result.guessedPeriod).toBe("week");
    expect(result.periodConfident).toBe(true);
  });

  it("app names further down never trigger the header rule", () => {
    // "Day One" as the 9th line is past the header window.
    const filler = "MOST USED\nInstagram\n2h\nMail\n1h\nSlack\n1h\nReddit\n30m";
    const result = parseScreenTimeText(`${filler}\nDay One\n20m`);
    expect(result.guessedPeriod).toBe("day"); // from magnitude, not the title
  });
});

describe("parseScreenTimeText - period sanity", () => {
  it("keeps small daily-average lists as 'day' even with Daily Average text", () => {
    const result = parseScreenTimeText(
      "Daily Average\n1h 34m\nMOST USED\nInstagram\n34m\nMail\n20m",
    );
    expect(result.guessedPeriod).toBe("day");
  });

  it("overrides an explicit 'today' when a single app exceeds 16h", () => {
    const result = parseScreenTimeText("Today\nInstagram\n22h 10m");
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
