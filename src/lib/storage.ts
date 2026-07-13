import type { SelectedHabit } from "./habits";

/** Versioned localStorage persistence with corrupt-data recovery. */

const KEY = "weeks.state.v1";

export interface PersistedState {
  birthDateInput: string;
  lifeExpectancy: number;
  sleepHours: number;
  habits: SelectedHabit[];
  /** Preset chip ids the user has deleted from the picker. */
  hiddenChips: string[];
}

export function loadState(): PersistedState | null {
  try {
    const raw = window.localStorage.getItem(KEY);
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
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded or private mode - the app works without persistence */
  }
}

/** Every key this app writes. Kept in one place so reset can't miss one. */
const ALL_KEYS = [
  KEY,
  "weeks.lifetime.v1",
  "weeks.countdown.v1",
  "weeks.theme",
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
