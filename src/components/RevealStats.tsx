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
  const [eqIndex, setEqIndex] = useState(0);

  const sorted = useMemo(
    () => [...habits].sort((a, b) => b.hoursPerDay - a.hoursPerDay),
    [habits],
  );
  const top = sorted[0];
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
    <section className="animate-fade-in-up space-y-4" data-testid="reveal-stats">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Of your {Math.round(span.remainingWakingWeeks).toLocaleString()} remaining
          waking weeks
        </p>
        <h2 className="mt-2 font-display text-3xl font-extrabold leading-tight sm:text-4xl">
          {top.label} takes{" "}
          <span style={{ color: cssVarHsl(top.colorVar) }}>
            {topLadder.years} years
          </span>
          .
        </h2>
        <p
          className="mt-2 font-mono text-sm tabular-nums text-muted-foreground"
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
            onClick={() => setEqIndex((i) => i + 1)}
            className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            data-testid="equivalence"
          >
            <Shuffle className="h-3.5 w-3.5" />
            {equivalences[eqIndex % equivalences.length].text}
          </button>
        )}
      </div>

      {habits.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">All habits combined</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums" data-testid="combined-ladder">
            {combinedLadder.weeks} wks · {combinedLadder.months} mo ·{" "}
            {combinedLadder.years} yrs
            <span className="ml-2 text-sm font-medium text-muted-foreground">
              ({combinedLadder.percent}% of waking life)
            </span>
          </p>
          <div className="mt-3 space-y-1.5">
            {sorted.map((h) => {
              const ladder = formatLadder(habitCost(h.hoursPerDay, span));
              return (
                <div
                  key={h.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: cssVarHsl(h.colorVar) }}
                    />
                    {h.label}
                    <span className="text-xs text-muted-foreground">
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
