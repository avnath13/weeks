import { Minus, Plus } from "lucide-react";
import {
  LIFE_EXPECTANCY_MAX,
  LIFE_EXPECTANCY_MIN,
  SLEEP_MAX,
  SLEEP_MIN,
  formatHoursPerDay,
  type BirthDateIssue,
} from "@/lib/timeMath";

interface HeroProps {
  birthDateInput: string;
  onBirthDateChange: (v: string) => void;
  birthIssue: BirthDateIssue | null;
  lifeExpectancy: number;
  onLifeExpectancyChange: (v: number) => void;
  sleepHours: number;
  onSleepChange: (v: number) => void;
}

const ISSUE_COPY: Record<BirthDateIssue, string> = {
  empty: "",
  invalid: "That date doesn't exist — check the day and month.",
  future: "You haven't been born yet? Pick a date in the past.",
  "too-old": "Over 120 years — check the year.",
};

function Stepper({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground transition-colors hover:bg-accent disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span
          data-testid={testId}
          className="min-w-[3.5rem] text-center font-mono text-sm font-semibold tabular-nums"
        >
          {display}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground transition-colors hover:bg-accent disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function Hero({
  birthDateInput,
  onBirthDateChange,
  birthIssue,
  lifeExpectancy,
  onLifeExpectancyChange,
  sleepHours,
  onSleepChange,
}: HeroProps) {
  return (
    <section className="animate-fade-in-up">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        Memento mori
      </p>
      <h1 className="mt-3 font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl">
        Your life is
        <br />
        ~4,000 weeks.
      </h1>
      <p className="mt-4 max-w-md text-lg text-muted-foreground">
        Want to see where the rest of them are going?
      </p>

      <div className="mt-8 max-w-md space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            When were you born?
          </span>
          <input
            type="date"
            data-testid="birthdate-input"
            value={birthDateInput}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => onBirthDateChange(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-base shadow-sm outline-none ring-primary/50 transition-shadow focus:ring-2"
          />
        </label>
        {birthIssue && ISSUE_COPY[birthIssue] && (
          <p className="text-sm text-destructive" role="alert" data-testid="birthdate-error">
            {ISSUE_COPY[birthIssue]}
          </p>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Stepper
            label="Live to"
            value={lifeExpectancy}
            display={`${lifeExpectancy}`}
            min={LIFE_EXPECTANCY_MIN}
            max={LIFE_EXPECTANCY_MAX}
            step={1}
            onChange={onLifeExpectancyChange}
            testId="life-expectancy-value"
          />
          <Stepper
            label="Sleep"
            value={sleepHours}
            display={formatHoursPerDay(sleepHours)}
            min={SLEEP_MIN}
            max={SLEEP_MAX}
            step={0.5}
            onChange={onSleepChange}
            testId="sleep-value"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Everything below is measured in <strong>waking time</strong> — your{" "}
          {24 - sleepHours} waking hours a day.
        </p>
      </div>
    </section>
  );
}
