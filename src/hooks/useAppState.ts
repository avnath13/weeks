import { useEffect, useMemo, useRef, useState } from "react";
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
import { loadState, saveState } from "@/lib/storage";

export interface AppState {
  birthDateInput: string;
  setBirthDateInput: (v: string) => void;
  lifeExpectancy: number;
  setLifeExpectancy: (v: number) => void;
  sleepHours: number;
  setSleepHours: (v: number) => void;
  habits: SelectedHabit[];
  setHabits: React.Dispatch<React.SetStateAction<SelectedHabit[]>>;
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
  const persisted = useRef(loadState()).current;

  const [birthDateInput, setBirthDateInput] = useState(
    persisted?.birthDateInput ?? "",
  );
  const [lifeExpectancy, setLifeExpectancyRaw] = useState(
    clampLifeExpectancy(persisted?.lifeExpectancy ?? LIFE_EXPECTANCY_DEFAULT),
  );
  const [sleepHours, setSleepHoursRaw] = useState(
    clampSleepHours(persisted?.sleepHours ?? SLEEP_DEFAULT),
  );
  const [habits, setHabits] = useState<SelectedHabit[]>(
    persisted?.habits ?? [],
  );
  const [reclaimMode, setReclaimMode] = useState(false);

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
        saveState({ birthDateInput, lifeExpectancy, sleepHours, habits }),
      400,
    );
    return () => window.clearTimeout(id);
  }, [birthDateInput, lifeExpectancy, sleepHours, habits]);

  return {
    birthDateInput,
    setBirthDateInput,
    lifeExpectancy,
    setLifeExpectancy: (v) => setLifeExpectancyRaw(clampLifeExpectancy(v)),
    sleepHours,
    setSleepHours: (v) => setSleepHoursRaw(clampSleepHours(v)),
    habits,
    setHabits,
    reclaimMode,
    setReclaimMode,
    span,
    birthMs,
    birthIssue,
    now,
  };
}
