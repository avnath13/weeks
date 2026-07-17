import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Flag, Sparkles, X } from "lucide-react";
import {
  formatHoursPerDay,
  reclaimedWeeks,
  WEEKS_PER_MONTH,
  WEEKS_PER_YEAR,
  type LifeSpan,
} from "@/lib/timeMath";
import type { SelectedHabit } from "@/lib/habits";
import {
  commitmentProgress,
  formatBanked,
  type Commitment,
} from "@/lib/commitment";
import {
  addCheckIn,
  clearCommitment,
  loadCheckIns,
  loadCommitment,
  saveCommitment,
} from "@/lib/storage";
import { cn, todayIso } from "@/lib/utils";
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
  const [commitment, setCommitment] = useState<Commitment | null>(
    loadCommitment,
  );
  const [checkIns, setCheckIns] = useState(loadCheckIns);
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  // A screenshot import (sibling component) can record a check-in; pick it
  // up without lifting the whole commitment state to App.
  useEffect(() => {
    const refresh = () => setCheckIns(loadCheckIns());
    window.addEventListener("weeks:checkin", refresh);
    return () => window.removeEventListener("weeks:checkin", refresh);
  }, []);

  const totalReclaimed = useMemo(
    () =>
      habits.reduce(
        (s, h) => s + reclaimedWeeks(h.hoursPerDay, h.reclaimHours, span),
        0,
      ),
    [habits, span],
  );

  const progress = useMemo(
    () =>
      commitment
        ? commitmentProgress(commitment, checkIns, span, Date.now())
        : null,
    [commitment, checkIns, span],
  );

  const commit = () => {
    const targets = habits
      .filter((h) => h.reclaimHours < h.hoursPerDay)
      .map((h) => ({
        id: h.id,
        label: h.label,
        emoji: h.emoji,
        colorVar: h.colorVar,
        fromHours: h.hoursPerDay,
        toHours: h.reclaimHours,
      }));
    if (targets.length === 0) return;
    const next: Commitment = { startedAt: todayIso(), targets };
    saveCommitment(next);
    setCommitment(next);
  };

  const logToday = () => {
    if (!commitment) return;
    const hours: Record<string, number> = {};
    for (const h of habits) hours[h.id] = h.hoursPerDay;
    setCheckIns(addCheckIn({ date: todayIso(), hours }));
  };

  const endCommitment = () => {
    clearCommitment();
    setCommitment(null);
    setCheckIns([]);
    setConfirmingEnd(false);
  };

  if (habits.length === 0 || span.onBonusTime) return null;

  return (
    <section
      className={cn(
        "animate-fade-in-up rounded-xl border p-5 transition-colors",
        reclaimMode || commitment
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
                step={Math.min(1 / 12, h.hoursPerDay)}
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
                className="slider mt-2"
                style={{ "--range-color": cssVarHsl("--event-emerald") } as React.CSSProperties}
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

          {!commitment && totalReclaimed > 0 && (
            <button
              type="button"
              data-testid="commit-button"
              onClick={commit}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-event-emerald px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <Flag className="h-4 w-4" /> Commit to this plan
            </button>
          )}
          {!commitment && totalReclaimed > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              A commitment pins these targets. Check in later - re-import a
              Screen Time screenshot or log your numbers - and see the weeks
              you actually banked.
            </p>
          )}
        </div>
      )}

      {commitment && progress && (
        <div className="mt-4 space-y-3" data-testid="commitment-card">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold">
              Your commitment
              <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                day {progress.daysSinceStart + 1} ·{" "}
                {progress.checkInCount === 0
                  ? "no check-ins yet"
                  : `${progress.checkInCount} check-in${progress.checkInCount === 1 ? "" : "s"}`}
              </span>
            </p>
            {!confirmingEnd ? (
              <button
                type="button"
                data-testid="end-commitment"
                onClick={() => setConfirmingEnd(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                <X className="h-3 w-3" /> End
              </button>
            ) : (
              <span className="flex items-center gap-2 text-xs">
                Delete it and its check-ins?
                <button
                  type="button"
                  data-testid="end-commitment-yes"
                  onClick={endCommitment}
                  className="font-semibold text-destructive underline-offset-2 hover:underline"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingEnd(false)}
                  className="text-muted-foreground underline-offset-2 hover:underline"
                >
                  Keep
                </button>
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            {progress.targets.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                data-testid={`commitment-target-${t.id}`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: cssVarHsl(t.colorVar) }}
                  />
                  {t.label}
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatHoursPerDay(t.fromHours)} →{" "}
                    {formatHoursPerDay(t.toHours)}/day
                  </span>
                </span>
                <span className="font-mono text-xs tabular-nums">
                  {t.latestHours === null ? (
                    <span className="text-muted-foreground">not measured yet</span>
                  ) : t.onTrack ? (
                    <span className="text-event-emerald">
                      ✓ {formatHoursPerDay(t.latestHours)}/day
                    </span>
                  ) : (
                    <span className="text-event-amber">
                      {formatHoursPerDay(t.latestHours)}/day - over target
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>

          <div
            className="rounded-lg bg-event-emerald/10 p-4 text-center"
            data-testid="commitment-banked"
          >
            <p className="font-display text-2xl font-extrabold text-event-emerald">
              {progress.totalWeeksBanked > 0
                ? `${formatBanked(progress.totalWeeksBanked)} banked`
                : "Nothing banked yet"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {progress.checkInCount === 0
                ? "Progress only counts from evidence. Re-import a Screen Time screenshot, or set your sliders to today's reality and log it."
                : "Waking life you actually got back, measured from your check-ins."}
            </p>
          </div>

          <button
            type="button"
            data-testid="log-today"
            onClick={logToday}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-event-emerald/50 px-4 py-2.5 text-sm font-semibold text-event-emerald transition-colors hover:bg-event-emerald/10"
          >
            <CalendarCheck2 className="h-4 w-4" /> Log today's numbers
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Logs each habit's current hours/day as today's reading. Importing
            a screenshot on this tab checks in automatically.
          </p>
        </div>
      )}
    </section>
  );
}
