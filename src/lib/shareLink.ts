import {
  clampLifeExpectancy,
  clampSleepHours,
  parseDateInput,
} from "./timeMath";
import {
  CUSTOM_COLOR_VARS,
  HABIT_PRESETS,
  type SelectedHabit,
} from "./habits";

/**
 * Shareable prefill links. Everything rides in the URL hash, after the tab:
 *
 *   https://weeks-mu.vercel.app/#life?b=1993-06-15&le=80&sl=8&h=Instagram:2.5,Commute:0.7
 *
 * No backend, nothing logged: hash fragments are never sent to the server.
 * A recipient opening the link lands on a grid pre-filled with the sender's
 * setup, then the params are stripped so their own edits persist normally.
 */

export interface SharePrefill {
  birthDateInput: string;
  lifeExpectancy: number | null;
  sleepHours: number | null;
  habits: SelectedHabit[];
}

const MAX_SHARED_HABITS = 8;

function habitFromShared(
  label: string,
  hours: number,
  index: number,
): SelectedHabit {
  const preset = HABIT_PRESETS.find(
    (p) => p.label.toLowerCase() === label.toLowerCase(),
  );
  return {
    id: preset?.id ?? `app-${label.toLowerCase().replace(/\s+/g, "-")}`,
    label: preset?.label ?? label,
    emoji: preset?.emoji ?? "📲",
    colorVar:
      preset?.colorVar ?? CUSTOM_COLOR_VARS[index % CUSTOM_COLOR_VARS.length],
    hoursPerDay: hours,
    reclaimHours: hours,
  };
}

/** Build a link that reproduces this setup for someone else. */
export function buildShareLink(state: {
  birthDateInput: string;
  lifeExpectancy: number;
  sleepHours: number;
  habits: SelectedHabit[];
}): string {
  const params = new URLSearchParams();
  params.set("b", state.birthDateInput);
  params.set("le", String(state.lifeExpectancy));
  params.set("sl", String(state.sleepHours));
  if (state.habits.length > 0) {
    params.set(
      "h",
      state.habits
        .slice(0, MAX_SHARED_HABITS)
        .map(
          (h) =>
            `${encodeURIComponent(h.label)}:${Math.round(h.hoursPerDay * 100) / 100}`,
        )
        .join(","),
    );
  }
  return `${window.location.origin}${window.location.pathname}#life?${params.toString()}`;
}

/** Parse prefill params out of a location hash; null when there are none. */
export function parseShareParams(hash: string): SharePrefill | null {
  const qIdx = hash.indexOf("?");
  if (qIdx < 0) return null;
  const params = new URLSearchParams(hash.slice(qIdx + 1));

  const birthDateInput = params.get("b") ?? "";
  if (parseDateInput(birthDateInput) === null) return null;

  const le = Number(params.get("le"));
  const sl = Number(params.get("sl"));

  const habits: SelectedHabit[] = [];
  const rawHabits = params.get("h");
  if (rawHabits) {
    for (const part of rawHabits.split(",").slice(0, MAX_SHARED_HABITS)) {
      const sep = part.lastIndexOf(":");
      if (sep <= 0) continue;
      const label = decodeURIComponent(part.slice(0, sep)).trim().slice(0, 24);
      const hours = Number(part.slice(sep + 1));
      if (label.length < 2 || !Number.isFinite(hours) || hours <= 0 || hours > 24)
        continue;
      if (habits.some((h) => h.label.toLowerCase() === label.toLowerCase()))
        continue;
      habits.push(habitFromShared(label, hours, habits.length));
    }
  }

  return {
    birthDateInput,
    lifeExpectancy: Number.isFinite(le) ? clampLifeExpectancy(le) : null,
    sleepHours: Number.isFinite(sl) ? clampSleepHours(sl) : null,
    habits,
  };
}

/** Remove prefill params from the address bar, keeping the tab hash. */
export function stripShareParams(): void {
  const hash = window.location.hash;
  const qIdx = hash.indexOf("?");
  if (qIdx < 0) return;
  window.history.replaceState(null, "", hash.slice(0, qIdx) || "#life");
}
