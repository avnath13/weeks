import { Minus, Plus } from "lucide-react";
import {
  LIFE_EXPECTANCY_MAX,
  LIFE_EXPECTANCY_MIN,
  SLEEP_MAX,
  SLEEP_MIN,
  formatHoursPerDay,
  type BirthDateIssue,
} from "@/lib/timeMath";
import { todayIso } from "@/lib/utils";

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
  invalid: "That date doesn't exist. Check the day and month.",
  future: "You haven't been born yet? Pick a date in the past.",
  "too-old": "That's over 120 years ago. Check the year.",
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
    <div className="flex items-center justify-between gap-3 border-b border-border py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span
          data-testid={testId}
          className="min-w-[3.5rem] text-center font-mono text-base font-bold tabular-nums"
        >
          {display}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
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
      <h1 className="max-w-3xl font-display text-6xl font-extrabold leading-[0.98] tracking-[-0.03em] sm:text-8xl">
        Your life is
        <br />
        <span className="text-primary">~4,000</span> weeks.
      </h1>
      <p className="mt-5 max-w-md text-lg text-muted-foreground">
        Want to see where the rest of them are going?
      </p>

      <div className="mt-10 max-w-md">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Born
          </span>
          <input
            type="date"
            data-testid="birthdate-input"
            value={birthDateInput}
            max={todayIso()}
            onChange={(e) => onBirthDateChange(e.target.value)}
            className="mt-1.5 w-full border-b-2 border-border bg-transparent py-2 font-mono text-xl font-bold tabular-nums outline-none transition-colors focus:border-primary"
          />
        </label>
        {birthIssue && ISSUE_COPY[birthIssue] && (
          <p className="mt-2 text-sm text-destructive" role="alert" data-testid="birthdate-error">
            {ISSUE_COPY[birthIssue]}
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
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
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Everything below is measured in <strong>waking time</strong>: your{" "}
          {24 - sleepHours} waking hours a day.
        </p>
      </div>
    </section>
  );
}
