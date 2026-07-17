import { useMemo, useState } from "react";
import { Shuffle } from "lucide-react";
import {
  formatHoursPerDay,
  formatLadder,
  habitCost,
  type LifeSpan,
} from "@/lib/timeMath";
import type { SelectedHabit } from "@/lib/habits";
import { buildEquivalences } from "@/lib/equivalences";
import { cssVarHsl } from "@/lib/gridDraw";

interface RevealStatsProps {
  span: LifeSpan;
  habits: SelectedHabit[];
}

export function RevealStats({ span, habits }: RevealStatsProps) {
  const sorted = useMemo(
    () => [...habits].sort((a, b) => b.hoursPerDay - a.hoursPerDay),
    [habits],
  );
  const top = sorted[0];

  // The shuffle count is stored with the habit it belongs to, so switching
  // headline habits restarts the rotation instead of reusing a stale index.
  const [shuffle, setShuffle] = useState<{ id: string | null; count: number }>(
    { id: null, count: 0 },
  );
  const eqIndex = shuffle.id === top?.id ? shuffle.count : 0;
  const topCost = top ? habitCost(top.hoursPerDay, span) : null;
  const topLadder = topCost ? formatLadder(topCost) : null;

  const combined = useMemo(() => {
    const hours = habits.reduce((s, h) => s + h.hoursPerDay, 0);
    return habitCost(hours, span);
  }, [habits, span]);
  const combinedLadder = formatLadder(combined);

  const equivalences = useMemo(
    () => (top && topCost ? buildEquivalences(topCost, top.label) : []),
    [top, topCost],
  );

  if (habits.length === 0 || !top || !topLadder) return null;

  if (span.onBonusTime) {
    return (
      <section className="animate-fade-in-up rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-2xl font-bold">
          You've outlived your own forecast.
        </h2>
        <p className="mt-2 text-muted-foreground">
          Every week now is a bonus week - raise your life expectancy above to
          keep counting, or treat the whole grid as found time.
        </p>
      </section>
    );
  }

  return (
    <section className="animate-fade-in-up space-y-8" data-testid="reveal-stats">
      <div
        className="border-l-4 pl-5 sm:pl-6"
        style={{ borderColor: cssVarHsl(top.colorVar) }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Of your {Math.round(span.remainingWakingWeeks).toLocaleString()}{" "}
          remaining waking weeks
        </p>
        <h2 className="mt-3 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
          {top.label} takes{" "}
          <span style={{ color: cssVarHsl(top.colorVar) }}>
            {topLadder.years} years
          </span>
          .
        </h2>
        <p
          className="mt-3 font-mono text-sm tabular-nums text-muted-foreground"
          data-testid="unit-ladder"
        >
          = {topLadder.weeks} weeks · {topLadder.months} months ·{" "}
          <strong className="text-foreground">
            {topLadder.percent}% of your remaining waking life
          </strong>
        </p>

        {equivalences.length > 0 && (
          <button
            type="button"
            onClick={() => setShuffle({ id: top.id, count: eqIndex + 1 })}
            className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            data-testid="equivalence"
          >
            <Shuffle className="h-3.5 w-3.5" />
            {equivalences[eqIndex % equivalences.length].text}
          </button>
        )}
      </div>

      {habits.length > 1 && (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              All habits combined
            </p>
            <p className="font-mono text-sm font-bold tabular-nums" data-testid="combined-ladder">
              {combinedLadder.weeks} wks · {combinedLadder.months} mo ·{" "}
              {combinedLadder.years} yrs
              <span className="ml-1.5 font-medium text-muted-foreground">
                ({combinedLadder.percent}%)
              </span>
            </p>
          </div>
          <div>
            {sorted.map((h) => {
              const ladder = formatLadder(habitCost(h.hoursPerDay, span));
              return (
                <div
                  key={h.id}
                  className="flex items-center justify-between border-b border-border py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-[3px]"
                      style={{ backgroundColor: cssVarHsl(h.colorVar) }}
                    />
                    {h.label}
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatHoursPerDay(h.hoursPerDay)}/day
                    </span>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {ladder.weeks} wks · {ladder.years} yrs
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
