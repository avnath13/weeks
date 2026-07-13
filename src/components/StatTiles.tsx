import { useState } from "react";
import { WEEKS_PER_MONTH, type LifeSpan } from "@/lib/timeMath";
import { cn } from "@/lib/utils";

/**
 * Big-number stat tiles (months / weeks / days / percent), with a toggle
 * that flips between "lived so far" and "still left". The day count is the
 * sleeper hit: 12,053 days feels both huge and terrifyingly countable.
 */
export function StatTiles({ span }: { span: LifeSpan }) {
  const [showLeft, setShowLeft] = useState(false);

  const totalMonths = Math.round(span.totalWeeks / WEEKS_PER_MONTH);
  const livedMonths = Math.min(
    totalMonths,
    Math.round(span.livedWeeks / WEEKS_PER_MONTH),
  );

  const tiles = showLeft
    ? [
        { label: "months left", big: totalMonths - livedMonths, small: totalMonths },
        { label: "weeks left", big: span.remainingWeeks, small: span.totalWeeks },
        { label: "days left", big: span.totalDays - span.livedDays, small: span.totalDays },
        { label: "left, %", big: Math.max(0, 100 - Math.round(span.percentLived)), small: 100 },
      ]
    : [
        { label: "months", big: livedMonths, small: totalMonths },
        { label: "weeks", big: span.livedWeeks, small: span.totalWeeks },
        { label: "days", big: span.livedDays, small: span.totalDays },
        { label: "lived, %", big: Math.round(span.percentLived), small: 100 },
      ];

  return (
    <div data-testid="stat-tiles">
      <div className="grid grid-cols-2 border-y border-border sm:grid-cols-4">
        {tiles.map((t, i) => (
          <div
            key={t.label}
            className={cn(
              "border-border px-4 py-4 sm:px-6",
              i === 0 && "pl-0",
              i % 2 === 1 && "border-l",           // mobile: hairline between the two columns
              i >= 2 && "border-t sm:border-t-0",  // mobile: hairline between the two rows
              i > 0 && "sm:border-l",              // desktop: hairline between all four
              i === 2 && "max-sm:pl-0",
            )}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {t.label}
            </p>
            <p className="mt-1.5 font-mono tabular-nums">
              <span className="text-3xl font-bold tracking-tight">
                {t.big.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">
                {" "}/{t.small.toLocaleString()}
              </span>
            </p>
          </div>
        ))}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={showLeft}
        data-testid="stat-tiles-toggle"
        onClick={() => setShowLeft((s) => !s)}
        className="mt-2.5 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <span
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors",
            showLeft ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
              showLeft ? "left-[18px]" : "left-0.5",
            )}
          />
        </span>
        Show how much life is left
      </button>
    </div>
  );
}
