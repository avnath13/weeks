import type { SelectedHabit } from "./habits";

/**
 * Versioned localStorage persistence with corrupt-data recovery.
 *
 * EVERY key the app reads or writes lives in this module - components must
 * not touch localStorage directly. That keeps reset and export/import
 * complete by construction: a new key added here is automatically wiped by
 * clearAllData and carried by export files.
 */

const KEY = "weeks.state.v1";
const LIFETIME_KEY = "weeks.lifetime.v1";
const COUNTDOWN_KEY = "weeks.countdown.v1";
const THEME_KEY = "weeks.theme";

export interface PersistedState {
  birthDateInput: string;
  lifeExpectancy: number;
  sleepHours: number;
  habits: SelectedHabit[];
  /** Preset chip ids the user has deleted from the picker. */
  hiddenChips: string[];
  /** Reclaim-mode toggle; persisted so the view survives a reload. */
  reclaimMode: boolean;
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota exceeded or private mode - the app works without persistence */
  }
}

export function loadState(): PersistedState | null {
  try {
    const raw = readRaw(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (
      typeof parsed.birthDateInput !== "string" ||
      typeof parsed.lifeExpectancy !== "number" ||
      typeof parsed.sleepHours !== "number" ||
      !Array.isArray(parsed.habits)
    )
      return null;
    const habits = parsed.habits.filter(
      (h): h is SelectedHabit =>
        typeof h === "object" &&
        h !== null &&
        typeof h.id === "string" &&
        typeof h.label === "string" &&
        typeof h.colorVar === "string" &&
        typeof h.hoursPerDay === "number" &&
        Number.isFinite(h.hoursPerDay),
    );
    return {
      birthDateInput: parsed.birthDateInput,
      lifeExpectancy: parsed.lifeExpectancy,
      sleepHours: parsed.sleepHours,
      habits: habits.map((h) => ({
        ...h,
        reclaimHours:
          typeof h.reclaimHours === "number" && Number.isFinite(h.reclaimHours)
            ? h.reclaimHours
            : h.hoursPerDay,
      })),
      hiddenChips: Array.isArray(parsed.hiddenChips)
        ? parsed.hiddenChips.filter((c): c is string => typeof c === "string")
        : [],
      reclaimMode: parsed.reclaimMode === true,
    };
  } catch {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* storage unavailable (private mode) - nothing to do */
    }
    return null;
  }
}

export function saveState(state: PersistedState): void {
  writeRaw(KEY, JSON.stringify(state));
}

/** Per-activity hours tweaks on the Lifetime tab, keyed by activity id. */
export function loadLifetimeHours(): Record<string, number> | null {
  try {
    const raw = readRaw(LIFETIME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return null;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

export function saveLifetimeHours(hours: Record<string, number>): void {
  writeRaw(LIFETIME_KEY, JSON.stringify(hours));
}

export function loadCountdownRaw(): unknown {
  try {
    const raw = readRaw(COUNTDOWN_KEY);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function saveCountdownRaw(value: unknown): void {
  writeRaw(COUNTDOWN_KEY, JSON.stringify(value));
}

export type StoredTheme = "light" | "dark";

export function loadTheme(): StoredTheme | null {
  const stored = readRaw(THEME_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

export function saveTheme(theme: StoredTheme): void {
  writeRaw(THEME_KEY, theme);
}

/** Every key this app writes. Kept in one place so reset can't miss one. */
const ALL_KEYS = [
  KEY,
  LIFETIME_KEY,
  COUNTDOWN_KEY,
  THEME_KEY,
  "bigpicture.theme", // legacy theme key from before the weeks.* rename
];

/** Wipe everything the app stored on this device. */
export function clearAllData(): void {
  for (const key of ALL_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* storage unavailable: nothing to clear */
    }
  }
}

/* ---------------------------------------------------------------- backup */

interface ExportFile {
  app: "weeks";
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

/** Serialize everything the app stored, for a downloadable backup file. */
export function exportAllData(): string {
  const data: Record<string, unknown> = {};
  for (const key of ALL_KEYS) {
    const raw = readRaw(key);
    if (raw === null) continue;
    if (key === THEME_KEY || key === "bigpicture.theme") {
      data[key] = raw; // stored as a bare string, not JSON
    } else {
      try {
        data[key] = JSON.parse(raw);
      } catch {
        /* corrupt entry: leave it out of the backup */
      }
    }
  }
  return JSON.stringify(
    {
      app: "weeks",
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    } satisfies ExportFile,
    null,
    2,
  );
}

/**
 * Restore a backup produced by exportAllData. Only known keys are written;
 * each loader re-validates on next read, so a hand-edited file can't
 * corrupt the app. Returns false when the file isn't a weeks backup.
 */
export function importAllData(json: string): boolean {
  let parsed: Partial<ExportFile>;
  try {
    parsed = JSON.parse(json) as Partial<ExportFile>;
  } catch {
    return false;
  }
  if (
    parsed.app !== "weeks" ||
    typeof parsed.data !== "object" ||
    parsed.data === null
  )
    return false;
  for (const key of ALL_KEYS) {
    if (!(key in parsed.data)) continue;
    const value = parsed.data[key];
    if (key === THEME_KEY || key === "bigpicture.theme") {
      if (value === "light" || value === "dark") writeRaw(key, value);
    } else {
      writeRaw(key, JSON.stringify(value));
    }
  }
  return true;
}
