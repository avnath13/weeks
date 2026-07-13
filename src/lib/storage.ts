import type { SelectedHabit } from "./habits";

/** Versioned localStorage persistence with corrupt-data recovery. */

const KEY = "weeks.state.v1";

export interface PersistedState {
  birthDateInput: string;
  lifeExpectancy: number;
  sleepHours: number;
  habits: SelectedHabit[];
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
