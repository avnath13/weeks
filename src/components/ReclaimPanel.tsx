import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import {
  formatHoursPerDay,
  reclaimedWeeks,
  WEEKS_PER_MONTH,
  WEEKS_PER_YEAR,
  type LifeSpan,
} from "@/lib/timeMath";
import type { SelectedHabit } from "@/lib/habits";
import { cn } from "@/lib/utils";
import { cssVarHsl } from "@/lib/gridDraw";

interface ReclaimPanelProps {
  span: LifeSpan;
  habits: SelectedHabit[];
  setHabits: React.Dispatch<React.SetStateAction<SelectedHabit[]>>;
  reclaimMode: boolean;
  setReclaimMode: (v: boolean) => void;
}

export function ReclaimPanel({
  span,
  habits,
  setHabits,
  reclaimMode,
  setReclaimMode,
}: ReclaimPanelProps) {
  const totalReclaimed = useMemo(
    () =>
      habits.reduce(
        (s, h) => s + reclaimedWeeks(h.hoursPerDay, h.reclaimHours, span),
        0,
      ),
    [habits, span],
  );

  if (habits.length === 0 || span.onBonusTime) return null;

  return (
    <section
      className={cn(
        "animate-fade-in-up rounded-xl border p-5 transition-colors",
        reclaimMode
          ? "border-event-emerald/60 bg-event-emerald/5"
          : "border-border bg-card",
      )}
      data-testid="reclaim-panel"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <Sparkles className="text-event-emerald" size={18} />
            What if you took some back?
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Drag a habit down and watch the weeks return.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reclaimMode}
          data-testid="reclaim-toggle"
          onClick={() => setReclaimMode(!reclaimMode)}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            reclaimMode ? "bg-event-emerald" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
              reclaimMode ? "left-[22px]" : "left-0.5",
            )}
          />
        </button>
      </div>

      {reclaimMode && (
        <div className="mt-4 space-y-3 animate-fade-in">
          {habits.map((h) => (
            <div key={h.id} className="text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: cssVarHsl(h.colorVar) }}
                  />
                  {h.label}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatHoursPerDay(h.hoursPerDay)} →{" "}
                  <strong className="text-foreground">
                    {formatHoursPerDay(h.reclaimHours)}
                  </strong>
                  /day
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={h.hoursPerDay}
                step={0.25}
                value={h.reclaimHours}
                aria-label={`${h.label} reduced hours per day`}
                data-testid={`reclaim-slider-${h.id}`}
                onChange={(e) =>
                  setHabits((prev) =>
                    prev.map((x) =>
                      x.id === h.id
                        ? { ...x, reclaimHours: Number(e.target.value) }
                        : x,
                    ),
                  )
                }
                className="mt-1.5 w-full accent-event-emerald"
              />
            </div>
          ))}

          <div
            className="rounded-lg bg-event-emerald/10 p-4 text-center"
            data-testid="reclaim-total"
          >
            <p className="font-display text-3xl font-extrabold text-event-emerald">
              +{Math.round(totalReclaimed).toLocaleString()} weeks
            </p>
            <p className="mt-0.5 font-mono text-sm tabular-nums text-muted-foreground">
              +{(totalReclaimed / WEEKS_PER_MONTH).toFixed(0)} months · +
              {(totalReclaimed / WEEKS_PER_YEAR).toFixed(1)} years of waking
              life, back
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
