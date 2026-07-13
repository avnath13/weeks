import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { WEEKS_PER_YEAR, type LifeSpan } from "@/lib/timeMath";
import { formatHoursPerDay } from "@/lib/timeMath";
import { cssVarHsl } from "@/lib/gridDraw";

/**
 * Retrospective lifetime stats, inspired by lifeecalendar.com's calculator:
 * "by your age you have already spent N years on X, and will spend M more."
 * Uses the birth date, sleep, and expectancy the user already entered.
 */

interface Activity {
  id: string;
  label: string;
  emoji: string;
  hoursPerDay: number;
  colorVar: string;
  /** Age (years) the activity starts counting from. */
  startAge: number;
}

const DEFAULT_ACTIVITIES: Activity[] = [
  { id: "working", label: "Working", emoji: "💼", hoursPerDay: 5.7, colorVar: "--event-sky", startAge: 22 },
  { id: "phone", label: "On your phone", emoji: "📱", hoursPerDay: 4.5, colorVar: "--event-coral", startAge: 13 },
  { id: "tv", label: "TV & streaming", emoji: "📺", hoursPerDay: 2, colorVar: "--event-amber", startAge: 5 },
  { id: "eating", label: "Eating & drinking", emoji: "🍽️", hoursPerDay: 1.6, colorVar: "--event-emerald", startAge: 0 },
  { id: "chores", label: "Chores & errands", emoji: "🧺", hoursPerDay: 1, colorVar: "--event-slate", startAge: 18 },
  { id: "cooking", label: "Cooking", emoji: "🍳", hoursPerDay: 0.8, colorVar: "--event-orange", startAge: 18 },
  { id: "hygiene", label: "Bathroom & grooming", emoji: "🚿", hoursPerDay: 0.75, colorVar: "--event-teal", startAge: 0 },
  { id: "commuting", label: "Commuting", emoji: "🚗", hoursPerDay: 0.7, colorVar: "--event-violet", startAge: 18 },
  { id: "shopping", label: "Shopping", emoji: "🛒", hoursPerDay: 0.4, colorVar: "--event-rose", startAge: 16 },
  { id: "exercise", label: "Exercising", emoji: "🏃", hoursPerDay: 0.3, colorVar: "--event-emerald", startAge: 10 },
];

const STORAGE_KEY = "weeks.lifetime.v1";

function loadActivities(): Activity[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ACTIVITIES;
    const saved = JSON.parse(raw) as Record<string, number>;
    return DEFAULT_ACTIVITIES.map((a) =>
      typeof saved[a.id] === "number" && Number.isFinite(saved[a.id])
        ? { ...a, hoursPerDay: Math.min(16, Math.max(0, saved[a.id])) }
        : a,
    );
  } catch {
    return DEFAULT_ACTIVITIES;
  }
}

interface LifetimeStatsProps {
  span: LifeSpan;
  sleepHours: number;
  lifeExpectancy: number;
}

export function LifetimeStats({
  span,
  sleepHours,
  lifeExpectancy,
}: LifetimeStatsProps) {
  const [activities, setActivities] = useState<Activity[]>(loadActivities);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          Object.fromEntries(activities.map((a) => [a.id, a.hoursPerDay])),
        ),
      );
    } catch {
      /* private mode: stats still work, they just do not persist */
    }
  }, [activities]);

  const ageYears = span.livedWeeks / WEEKS_PER_YEAR;
  const yearsTo = (hoursPerDay: number, years: number) =>
    Math.max(0, (hoursPerDay * years * 365.2425) / 24 / 365.2425);

  const rows = [
    {
      id: "sleep",
      label: "Sleeping",
      emoji: "😴",
      colorVar: "--primary",
      fixed: true,
      hoursPerDay: sleepHours,
      spent: (sleepHours * ageYears) / 24,
      toCome: (sleepHours * Math.max(0, lifeExpectancy - ageYears)) / 24,
    },
    ...activities.map((a) => {
      const activeYearsSoFar = Math.max(0, ageYears - a.startAge);
      const activeYearsToCome = Math.max(
        0,
        lifeExpectancy - Math.max(ageYears, a.startAge),
      );
      return {
        id: a.id,
        label: a.label,
        emoji: a.emoji,
        colorVar: a.colorVar,
        fixed: false,
        hoursPerDay: a.hoursPerDay,
        spent: yearsTo(a.hoursPerDay, activeYearsSoFar),
        toCome: yearsTo(a.hoursPerDay, activeYearsToCome),
      };
    }),
  ].sort((x, y) => y.spent - x.spent);

  const setHours = (id: string, hours: number) =>
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, hoursPerDay: hours } : a)),
    );

  return (
    <section className="animate-fade-in-up" data-testid="lifetime-stats">
      <h2 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
        <History className="h-5 w-5 text-primary" />
        You are {Math.floor(ageYears)}. Here is where it went.
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cumulative years already spent, and what is still to come if nothing
        changes. Drag any activity to match your life.
      </p>

      <div className="mt-5 space-y-2.5">
        {rows.map((row, _i, all) => {
          const total = row.spent + row.toCome;
          const maxTotal = Math.max(...all.map((r) => r.spent + r.toCome), 1);
          const spentPct = total > 0 ? (row.spent / total) * 100 : 0;
          return (
            <div
              key={row.id}
              className="rounded-lg border border-border bg-card p-3.5"
              data-testid={`lifetime-row-${row.id}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: cssVarHsl(row.colorVar) }}
                  />
                  {row.emoji} {row.label}
                  <span className="text-xs text-muted-foreground">
                    {formatHoursPerDay(row.hoursPerDay)}/day
                  </span>
                </span>
                <span className="font-mono text-sm tabular-nums">
                  <strong>{row.spent.toFixed(1)} yrs</strong>
                  <span className="text-muted-foreground">
                    {" "}
                    spent · {row.toCome.toFixed(1)} to come
                  </span>
                </span>
              </div>

              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(total / maxTotal) * 100}%`,
                    background: `linear-gradient(to right, ${cssVarHsl(row.colorVar)} ${spentPct}%, ${cssVarHsl(row.colorVar, 0.3)} ${spentPct}%)`,
                  }}
                />
              </div>

              {!row.fixed && (
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={0.25}
                  value={row.hoursPerDay}
                  aria-label={`${row.label} hours per day`}
                  onChange={(e) => setHours(row.id, Number(e.target.value))}
                  className="mt-2 w-full accent-primary"
                />
              )}
              {row.fixed && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  From your sleep setting on the Life tab.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Bars are relative to your biggest time sink (solid = already spent,
        faded = projected to age {lifeExpectancy}). Activities start counting
        at a typical age (working at 22, phones at 13, and so on).
      </p>
    </section>
  );
}
