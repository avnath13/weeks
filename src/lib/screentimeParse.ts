/**
 * Pure parser for OCR text extracted from iOS Screen Time / Android Digital
 * Wellbeing screenshots. Separated from the OCR engine so it can be
 * unit-tested exhaustively.
 */

export interface ParsedApp {
  /** Canonical app id when matched against the dictionary, else null. */
  appId: string | null;
  /** Display label (canonical name, or the raw OCR text for unknown apps). */
  label: string;
  emoji: string;
  /** Duration exactly as parsed, in hours (per the screenshot's period). */
  hoursInPeriod: number;
  rawLine: string;
}

export type Period = "day" | "week";

export interface ParseResult {
  apps: ParsedApp[];
  /** Best guess at the screenshot's reporting period. */
  guessedPeriod: Period;
  /** True when the period was detected from explicit text (vs. heuristic). */
  periodConfident: boolean;
}

interface DictEntry {
  id: string;
  label: string;
  emoji: string;
  aliases: string[];
}

/** Known apps: OCR'd names snap to these even when slightly garbled. */
const APP_DICTIONARY: DictEntry[] = [
  { id: "instagram", label: "Instagram", emoji: "📸", aliases: ["instagram", "lnstagram", "1nstagram"] },
  { id: "tiktok", label: "TikTok", emoji: "🎵", aliases: ["tiktok", "tik tok", "tlktok"] },
  { id: "youtube", label: "YouTube", emoji: "▶️", aliases: ["youtube", "you tube", "youtubetv"] },
  { id: "x", label: "X (Twitter)", emoji: "🐦", aliases: ["twitter", "x"] },
  { id: "reddit", label: "Reddit", emoji: "👽", aliases: ["reddit"] },
  { id: "safari", label: "Safari", emoji: "🌐", aliases: ["safari"] },
  { id: "chrome", label: "Chrome", emoji: "🌐", aliases: ["chrome", "google chrome"] },
  { id: "facebook", label: "Facebook", emoji: "📘", aliases: ["facebook"] },
  { id: "snapchat", label: "Snapchat", emoji: "👻", aliases: ["snapchat"] },
  { id: "whatsapp", label: "WhatsApp", emoji: "💬", aliases: ["whatsapp", "whats app"] },
  { id: "messages", label: "Messages", emoji: "💬", aliases: ["messages", "imessage"] },
  { id: "netflix", label: "Netflix", emoji: "🎬", aliases: ["netflix"] },
  { id: "twitch", label: "Twitch", emoji: "🎮", aliases: ["twitch"] },
  { id: "discord", label: "Discord", emoji: "🎧", aliases: ["discord"] },
  { id: "telegram", label: "Telegram", emoji: "✈️", aliases: ["telegram"] },
  { id: "spotify", label: "Spotify", emoji: "🎧", aliases: ["spotify"] },
  { id: "mail", label: "Mail", emoji: "✉️", aliases: ["mail", "gmail", "outlook"] },
  { id: "slack", label: "Slack", emoji: "💼", aliases: ["slack"] },
];

/** Lines that are UI chrome, not app rows. */
const NOISE_PATTERNS =
  /screen time|see all|most used|show (categories|apps)|daily average|updated today|last week|this week|today|yesterday|limits|downtime|app & website activity|activity|categories|week total|avg|average|notifications|pickups|first used|settings|digital wellbeing|dashboard|unlocks/i;

/**
 * iOS "Most Used" rows often carry a category subtitle between the app name
 * and its duration ("Instagram" / "Social" / "14h 32m"). These must never be
 * mistaken for app names when pairing a duration with the lines above it.
 */
const CATEGORY_PATTERNS =
  /^(social( networking)?|entertainment|productivity( & finance)?|games|utilities|creativity|education|information & reading|reading( & reference)?|shopping( & food)?|travel|health & fitness|lifestyle|finance|business|music|photo & video|news|sports|weather|developer tools|graphics & design|medical|navigation|reference|food & drink|other)$/i;

/**
 * Duration formats seen in Screen Time / Digital Wellbeing:
 *   "2h 15m" · "2 h 15 m" · "2hr 15min" · "2 hr, 15 min" · "45m" · "1h"
 * OCR often reads "1h" as "1n" or "lh"; we accept h/hr/hrs/hour(s), and a
 * standalone-minutes form.
 */
const DURATION_RE =
  /(?:(?<!\d)(\d{1,3})\s*h(?:r|rs|our|ours)?\b[\s,]*(?:(\d{1,2})\s*m(?:in|ins|inute|inutes)?\b)?)|(?:(?<!\d)(\d{1,3})\s*m(?:in|ins|inute|inutes)?\b)/i;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Levenshtein distance capped at 3 (early exit) - enough for OCR noise. */
function editDistance(a: string, b: string, cap = 3): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    let rowMin = dp[0];
    for (let i = 1; i <= a.length; i++) {
      const cur = dp[i];
      dp[i] = Math.min(
        dp[i] + 1,
        dp[i - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = cur;
      rowMin = Math.min(rowMin, dp[i]);
    }
    if (rowMin > cap) return cap + 1;
  }
  return dp[a.length];
}

function matchApp(rawName: string): DictEntry | null {
  const name = normalize(rawName);
  if (name.length < 2) return null;
  for (const entry of APP_DICTIONARY) {
    for (const alias of entry.aliases) {
      if (name === alias) return entry;
      // Substring match for aliases ≥ 5 chars (avoid "x" matching everything).
      if (alias.length >= 5 && (name.includes(alias) || alias.includes(name) && name.length >= 5)) {
        return entry;
      }
      if (alias.length >= 5 && editDistance(name, alias, 2) <= 2) return entry;
    }
  }
  return null;
}

/**
 * OCR habitually misreads digits/units in the small gray duration text:
 * "l4h" for "14h", "I h" for "1h", "O" for "0", "32rn" for "32m". Clean the
 * common confusions before matching, in duration-looking contexts only.
 */
function cleanDurationNoise(text: string): string {
  return text
    .replace(/[lI](?=\d)/g, "1")
    .replace(/(?<=\d)[lI](?=\s*[hm])/gi, "1")
    .replace(/\bO(?=\d)/g, "0")
    .replace(/(?<=\d)\s*rn\b/gi, "m")
    .replace(/(?<=\d)\s*hn\b/gi, "h");
}

function parseDuration(raw: string): number | null {
  const text = cleanDurationNoise(raw);
  const m = DURATION_RE.exec(text);
  if (!m) return null;
  if (m[3] !== undefined) {
    const mins = Number(m[3]);
    return mins > 0 && mins < 1000 ? mins / 60 : null;
  }
  const hours = Number(m[1]);
  const mins = m[2] !== undefined ? Number(m[2]) : 0;
  if (hours > 24 * 7) return null;
  return hours + mins / 60;
}

/**
 * Parse OCR text into app/duration entries plus a period guess.
 *
 * Period heuristics (iOS): the weekly "See All Activity" view contains
 * "Daily Average" as its headline while listing WEEKLY per-app totals; the
 * day view contains "Today"/"Yesterday". Android Digital Wellbeing's
 * dashboard is daily. When no explicit marker exists we fall back on
 * magnitude: any single app over 5h is almost certainly a weekly total.
 */
export function parseScreenTimeText(text: string): ParseResult {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  let guessedPeriod: Period | null = null;
  let periodConfident = false;

  // NOTE: "Daily Average" deliberately implies nothing. iOS shows that
  // headline over lists of weekly totals AND over lists of per-day averages
  // depending on the view; treating it as a signal misled real users. Only
  // explicit day/week wording is trusted; otherwise magnitude decides and
  // the UI flags the guess for the user to flip.
  const full = text.toLowerCase();
  if (/last week|this week|weekly/.test(full)) {
    guessedPeriod = "week";
    periodConfident = true;
  } else if (/\btoday\b|\byesterday\b|digital wellbeing|dashboard/.test(full)) {
    guessedPeriod = "day";
    periodConfident = true;
  }

  const apps: ParsedApp[] = [];
  const seen = new Set<string>();

  // Screen Time lists come in two layouts: name and duration on the SAME
  // line ("Instagram 14h 32m" - common when OCR merges columns) or the name
  // on one line with the duration on the NEXT ("Instagram" / "14h 32m" -
  // the native iOS list layout). Handle both.
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const duration = parseDuration(line);
    if (duration === null) continue;

    let nameText = cleanDurationNoise(line).replace(DURATION_RE, " ").trim();
    let rawLine = line;
    if (!nameText || !/\p{L}{2}/u.test(nameText)) {
      // Duration-only line → walk up to two lines back for the app name,
      // skipping a category subtitle ("Instagram" / "Social" / "14h 32m").
      let found: string | null = null;
      for (let back = 1; back <= 2 && idx - back >= 0; back++) {
        const candidate = lines[idx - back];
        if (parseDuration(candidate) !== null) break; // ran into another row
        if (CATEGORY_PATTERNS.test(candidate.trim())) continue;
        if (NOISE_PATTERNS.test(candidate)) break;
        found = candidate;
        break;
      }
      if (!found) continue;
      nameText = found;
      rawLine = `${found} ${line}`;
    }
    if (NOISE_PATTERNS.test(nameText) || CATEGORY_PATTERNS.test(nameText.trim()))
      continue;

    const dict = matchApp(nameText);
    const label = dict?.label ?? cleanLabel(nameText);
    if (!label) continue;

    const key = (dict?.id ?? label).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    apps.push({
      appId: dict?.id ?? null,
      label,
      emoji: dict?.emoji ?? "📲",
      hoursInPeriod: duration,
      rawLine,
    });
  }

  const maxHours = Math.max(0, ...apps.map((a) => a.hoursInPeriod));
  if (guessedPeriod === null) {
    guessedPeriod = maxHours > 5 ? "week" : "day";
  } else if (guessedPeriod === "day" && maxHours > 16) {
    // No one has 16+ waking hours in one app in a day; must be weekly totals.
    guessedPeriod = "week";
    periodConfident = false;
  }

  return { apps, guessedPeriod, periodConfident };
}

function cleanLabel(raw: string): string | null {
  const cleaned = raw
    .replace(/[^\p{L}\p{N} '&.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 3 || cleaned.length > 30) return null;
  if (!/\p{L}{3}/u.test(cleaned)) return null;
  // Bundle-id system noise ("com.apple.helpviewer") is not an app the user
  // chose to use; drop it rather than surface it as a habit.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+){2,}$/i.test(cleaned)) return null;
  return cleaned;
}

/**
 * Convert a parsed entry to hours/day given the chosen period.
 * 5-minute granularity, with a 5-minute floor for any nonzero value so a
 * real-but-small duration never displays (or applies) as 0h/day.
 */
export function toHoursPerDay(hoursInPeriod: number, period: Period): number {
  const perDay = period === "week" ? hoursInPeriod / 7 : hoursInPeriod;
  if (perDay <= 0) return 0;
  return Math.max(1 / 12, Math.round(perDay * 12) / 12);
}
