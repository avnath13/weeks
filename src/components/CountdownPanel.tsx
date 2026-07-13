import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Share2, Loader2, Check } from "lucide-react";
import {
  computeCountdown,
  parseDateInput,
  type LifeSpan,
} from "@/lib/timeMath";
import { LifeGrid } from "@/components/LifeGrid";
import { cssVarHsl, type GridSegment } from "@/lib/gridDraw";
import { renderCountdownCard, shareOrDownload } from "@/lib/shareCard";
import type { Theme } from "@/hooks/useTheme";

const STORAGE_KEY = "weeks.countdown.v1";

interface Saved {
  label: string;
  dateInput: string;
}

function loadSaved(): Saved {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { label: "", dateInput: "" };
    const parsed = JSON.parse(raw) as Partial<Saved>;
    return {
      label: typeof parsed.label === "string" ? parsed.label.slice(0, 40) : "",
      dateInput: typeof parsed.dateInput === "string" ? parsed.dateInput : "",
    };
  } catch {
    return { label: "", dateInput: "" };
  }
}

/** "Time left today" rings, hat-tip to lifeecalendar's countdown timer. */
function TodayRings() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const endOfDay = new Date(now);
  endOfDay.setHours(24, 0, 0, 0);
  const msLeft = endOfDay.getTime() - now.getTime();
  const totalSec = Math.floor(msLeft / 1000);
  const rings = [
    { label: "hours", value: Math.floor(totalSec / 3600), max: 24 },
    { label: "minutes", value: Math.floor((totalSec % 3600) / 60), max: 60 },
    { label: "seconds", value: totalSec % 60, max: 60 },
  ];

  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <div className="flex items-center justify-around gap-3" data-testid="today-rings">
      {rings.map((ring) => (
        <div key={ring.label} className="flex flex-col items-center gap-1.5">
          <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`${ring.value} ${ring.label} left today`}>
            <circle cx="44" cy="44" r={R} fill="none" strokeWidth="6" className="stroke-muted" />
            <circle
              cx="44"
              cy="44"
              r={R}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              className="stroke-primary"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - ring.value / ring.max)}
              transform="rotate(-90 44 44)"
              style={{ transition: "stroke-dashoffset 0.3s ease" }}
            />
            <text
              x="44"
              y="44"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground font-mono text-xl font-bold"
            >
              {ring.value}
            </text>
          </svg>
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {ring.label}
          </span>
        </div>
      ))}
    </div>
  );
}

interface CountdownPanelProps {
  span: LifeSpan;
  birthMs: number;
  theme: Theme;
  sleepHours: number;
  lifeExpectancy: number;
  now: number;
}

export function CountdownPanel({
  span,
  birthMs,
  theme,
  sleepHours,
  lifeExpectancy,
  now,
}: CountdownPanelProps) {
  const saved = useMemo(loadSaved, []);
  const [label, setLabel] = useState(saved.label);
  const [dateInput, setDateInput] = useState(saved.dateInput);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ label, dateInput }),
      );
    } catch {
      /* private mode: countdown still works without persistence */
    }
  }, [label, dateInput]);

  const targetMs = useMemo(() => parseDateInput(dateInput), [dateInput]);
  const countdown = useMemo(
    () => (targetMs !== null ? computeCountdown(targetMs, birthMs, span, now) : null),
    [targetMs, birthMs, span, now],
  );

  const highlight: GridSegment[] = useMemo(() => {
    if (!countdown || countdown.past || countdown.boxesUntil === 0) return [];
    return [
      {
        startWeek: countdown.startWeek,
        count: countdown.boxesUntil,
        color: cssVarHsl("--primary", 0.85),
      },
    ];
  }, [countdown]);

  const displayLabel = label.trim() || "the big day";

  const doShare = async () => {
    if (!countdown || countdown.past) return;
    setBusy(true);
    setFeedback(null);
    try {
      const canvas = await renderCountdownCard({
        span,
        label: displayLabel,
        countdown,
        sleepHours,
        lifeExpectancy,
      });
      const outcome = await shareOrDownload(canvas, "weeks-countdown.png");
      if (outcome === "downloaded") setFeedback("Saved to your downloads.");
      else if (outcome === "shared") setFeedback("Shared.");
    } catch {
      setFeedback("Couldn't generate the image on this browser.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="animate-fade-in-up" data-testid="countdown-panel">
      <h2 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
        <CalendarClock className="h-5 w-5 text-primary" />
        Counting down to something?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Put it on your grid. A date stops being abstract when you can see the
        boxes between here and there.
      </p>

      <div className="mt-5 grid max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 40))}
          placeholder="What is it? (Kid turns 18...)"
          data-testid="countdown-label"
          className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm shadow-sm outline-none ring-primary/50 transition-shadow focus:ring-2"
        />
        <input
          type="date"
          value={dateInput}
          onChange={(e) => setDateInput(e.target.value)}
          data-testid="countdown-date"
          className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm shadow-sm outline-none ring-primary/50 transition-shadow focus:ring-2"
        />
      </div>

      {countdown && countdown.past && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          That date already happened. Pick one that's still ahead of you.
        </p>
      )}

      {countdown && !countdown.past && (
        <div className="mt-6 space-y-5">
          <div className="rounded-xl border border-border bg-card p-5" data-testid="countdown-stats">
            <h3 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
              <span className="text-primary">
                {countdown.boxesUntil.toLocaleString()} boxes
              </span>{" "}
              until {displayLabel}.
            </h3>
            <p className="mt-2 font-mono text-sm tabular-nums text-muted-foreground">
              = {countdown.daysUntil.toLocaleString()} days ·{" "}
              <strong className="text-foreground">
                {countdown.percentOfRemainingWeeks.toFixed(1)}% of the weeks you
                have left
              </strong>
            </p>
            {countdown.beyondGrid && (
              <p className="mt-2 text-xs text-event-amber">
                Heads up: that date lands beyond your life expectancy grid.
              </p>
            )}
            <div className="mt-4">
              <LifeGrid
                span={span}
                habits={[]}
                reclaimMode={false}
                theme={theme}
                extraSegments={highlight}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              The highlighted band is the stretch of your life between now and{" "}
              {displayLabel}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="countdown-share"
              onClick={() => void doShare()}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              Get my countdown card
            </button>
            {feedback && (
              <span className="flex items-center gap-1.5 text-sm text-event-emerald">
                <Check className="h-4 w-4" /> {feedback}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 rounded-xl border border-border bg-card p-5">
        <p className="mb-4 text-center text-sm font-semibold">
          ⏳ Meanwhile, time left today
        </p>
        <TodayRings />
      </div>
    </section>
  );
}
