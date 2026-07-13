import { AnimatePresence, motion } from "framer-motion";
import type { LifeSpan } from "@/lib/timeMath";

/** Flip-digit weeks ticker - same visual language as bigpicture's countdown. */

function Digit({ value }: { value: string }) {
  return (
    <div className="relative h-9 w-6 overflow-hidden rounded-md bg-foreground font-mono text-xl font-bold text-background shadow-sm">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: -32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 32, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="absolute inset-0 flex items-center justify-center tabular-nums"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function Group({ value, label }: { value: number; label: string }) {
  const digits = Math.max(0, Math.round(value)).toLocaleString("en-US").split("");
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5">
        {digits.map((d, i) =>
          d === "," ? (
            <span
              key={i}
              className="self-end pb-1 font-mono text-lg font-bold text-muted-foreground/60"
            >
              ,
            </span>
          ) : (
            <Digit key={i} value={d} />
          ),
        )}
      </div>
      <span className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function WeeksTicker({ span }: { span: LifeSpan }) {
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-3" role="status">
      <Group value={span.remainingWeeks} label="weeks left" />
      <Group value={span.remainingWakingWeeks} label="awake" />
    </div>
  );
}

export function LifeProgressBar({ span }: { span: LifeSpan }) {
  const pct = Math.round(span.percentLived);
  return (
    <div className="w-full">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-event-violet transition-[width] duration-1000 ease-out"
          style={{ width: `${Math.min(100, span.percentLived)}%` }}
        />
      </div>
      <p className="mt-1.5 text-right text-xs text-muted-foreground">
        {pct}% lived
      </p>
    </div>
  );
}
