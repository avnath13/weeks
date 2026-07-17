import { useEffect, useMemo, useState } from "react";
import {
  computeLifeSpan,
  parseDateInput,
  validateBirthDate,
  clampLifeExpectancy,
  clampSleepHours,
  LIFE_EXPECTANCY_DEFAULT,
  SLEEP_DEFAULT,
  type BirthDateIssue,
  type LifeSpan,
} from "@/lib/timeMath";
import type { SelectedHabit } from "@/lib/habits";
import { clearAllData, loadState, saveState } from "@/lib/storage";
import { parseShareParams, stripShareParams } from "@/lib/shareLink";

export interface AppState {
  birthDateInput: string;
  setBirthDateInput: (v: string) => void;
  lifeExpectancy: number;
  setLifeExpectancy: (v: number) => void;
  sleepHours: number;
  setSleepHours: (v: number) => void;
  habits: SelectedHabit[];
  setHabits: React.Dispatch<React.SetStateAction<SelectedHabit[]>>;
  /** Preset chip ids the user deleted from the picker. */
  hiddenChips: string[];
  deleteChip: (id: string) => void;
  restoreChips: () => void;
  /** Wipe all stored data on this device and reload clean. */
  resetAll: () => void;
  reclaimMode: boolean;
  setReclaimMode: (v: boolean) => void;
  /** Derived - null until a valid birth date is entered. */
  span: LifeSpan | null;
  /** Local-midnight ms of the birth date, or null while invalid. */
  birthMs: number | null;
  birthIssue: BirthDateIssue | null;
  now: number;
}

export function useAppState(): AppState {
  // Lazy initializers: read persisted state and any share-link params once,
  // on first render only.
  const [persisted] = useState(loadState);
  // A shared link's prefill params beat persisted state (the recipient asked
  // for this exact setup by opening the link), then vanish from the URL so
  // the recipient's own edits persist as usual.
  const [shared] = useState(() => parseShareParams(window.location.hash));
  useEffect(() => {
    if (shared) stripShareParams();
  }, [shared]);

  const [birthDateInput, setBirthDateInput] = useState(
    shared?.birthDateInput ?? persisted?.birthDateInput ?? "",
  );
  const [lifeExpectancy, setLifeExpectancyRaw] = useState(
    clampLifeExpectancy(
      shared?.lifeExpectancy ??
        persisted?.lifeExpectancy ??
        LIFE_EXPECTANCY_DEFAULT,
    ),
  );
  const [sleepHours, setSleepHoursRaw] = useState(
    clampSleepHours(shared?.sleepHours ?? persisted?.sleepHours ?? SLEEP_DEFAULT),
  );
  const [habits, setHabits] = useState<SelectedHabit[]>(
    shared && shared.habits.length > 0 ? shared.habits : persisted?.habits ?? [],
  );
  const [hiddenChips, setHiddenChips] = useState<string[]>(
    persisted?.hiddenChips ?? [],
  );
  const [reclaimMode, setReclaimMode] = useState(
    persisted?.reclaimMode ?? false,
  );

  // "now" ticks weekly-precision state forward once a minute - cheap, and
  // keeps a left-open tab honest across midnight boundaries.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const birthMs = useMemo(() => parseDateInput(birthDateInput), [birthDateInput]);
  const birthIssue = useMemo(
    () => (birthDateInput === "" ? null : validateBirthDate(birthMs, now)),
    [birthDateInput, birthMs, now],
  );

  const span = useMemo(() => {
    if (birthMs === null || validateBirthDate(birthMs, now) !== null)
      return null;
    return computeLifeSpan(
      { birthMs, lifeExpectancy, sleepHours },
      now,
    );
  }, [birthMs, lifeExpectancy, sleepHours, now]);

  // Persist (debounced).
  useEffect(() => {
    const id = window.setTimeout(
      () =>
        saveState({
          birthDateInput,
          lifeExpectancy,
          sleepHours,
          habits,
          hiddenChips,
          reclaimMode,
        }),
      400,
    );
    return () => window.clearTimeout(id);
  }, [birthDateInput, lifeExpectancy, sleepHours, habits, hiddenChips, reclaimMode]);

  return {
    birthDateInput,
    setBirthDateInput,
    lifeExpectancy,
    setLifeExpectancy: (v) => setLifeExpectancyRaw(clampLifeExpectancy(v)),
    sleepHours,
    setSleepHours: (v) => setSleepHoursRaw(clampSleepHours(v)),
    habits,
    setHabits,
    hiddenChips,
    deleteChip: (id) => {
      setHiddenChips((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setHabits((prev) => prev.filter((h) => h.id !== id));
    },
    restoreChips: () => setHiddenChips([]),
    resetAll: () => {
      clearAllData();
      window.location.hash = "";
      window.location.reload();
    },
    reclaimMode,
    setReclaimMode,
    span,
    birthMs,
    birthIssue,
    now,
  };
}
