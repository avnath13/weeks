import { useEffect, useMemo, useState } from "react";
import { Share2, Loader2, Check, Plus, X } from "lucide-react";
import {
  computeCountdown,
  parseDateInput,
  type Countdown,
  type LifeSpan,
} from "@/lib/timeMath";
import { LifeGrid } from "@/components/LifeGrid";
import { cssVarHsl, type GridSegment } from "@/lib/gridDraw";
import { renderCountdownCard, shareOrDownload } from "@/lib/shareCard";
import type { Theme } from "@/hooks/useTheme";
import {
  loadCountdownEvents,
  saveCountdownEvents,
  type CountdownEvent,
} from "@/lib/storage";
import { cn } from "@/lib/utils";

const MAX_EVENTS = 6;

/** Band colors cycled across events (the featured band uses --primary). */
const EVENT_COLOR_VARS = [
  "--primary",
  "--event-amber",
  "--event-emerald",
  "--event-rose",
  "--event-sky",
  "--event-violet",
];

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
    // Clamp: a fall-back DST day has 25 wall-clock hours, which would
    // otherwise push the ring past full (negative dashoffset).
    { label: "hours", value: Math.min(24, Math.floor(totalSec / 3600)), max: 24 },
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
              y="49"
              textAnchor="middle"
              className="fill-foreground font-mono text-lg font-bold"
            >
              {ring.value}
            </text>
          </svg>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {ring.label}
          </span>
        </div>
      ))}
    </div>
  );
}

interface EventWithCountdown extends CountdownEvent {
  targetMs: number;
  countdown: Countdown;
  colorVar: string;
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
  const [events, setEvents] = useState<CountdownEvent[]>(loadCountdownEvents);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addLabel, setAddLabel] = useState("");
  const [addDate, setAddDate] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    saveCountdownEvents(events);
  }, [events]);

  // Upcoming events sorted soonest-first, each with its countdown + color.
  const upcoming: EventWithCountdown[] = useMemo(() => {
    return events
      .map((e) => ({ e, targetMs: parseDateInput(e.dateInput) }))
      .filter((x): x is { e: CountdownEvent; targetMs: number } => x.targetMs !== null)
      .map(({ e, targetMs }) => ({
        ...e,
        targetMs,
        countdown: computeCountdown(targetMs, birthMs, span, now),
      }))
      .filter((e) => !e.countdown.past)
      .sort((a, b) => a.targetMs - b.targetMs)
      .map((e, i) => ({
        ...e,
        colorVar: EVENT_COLOR_VARS[i % EVENT_COLOR_VARS.length],
      }));
  }, [events, birthMs, span, now]);

  const featured =
    upcoming.find((e) => e.id === selectedId) ?? upcoming[0] ?? null;

  // All bands share the current week as their origin, so paint the furthest
  // event first and the nearest last: what remains visible of each color is
  // the stretch between consecutive events.
  const highlight: GridSegment[] = useMemo(
    () =>
      [...upcoming]
        .reverse()
        .filter((e) => e.countdown.boxesUntil > 0)
        .map((e) => ({
          startWeek: e.countdown.startWeek,
          count: e.countdown.boxesUntil,
          color: cssVarHsl(e.colorVar, e.id === featured?.id ? 0.85 : 0.55),
        })),
    [upcoming, featured],
  );

  const addEvent = () => {
    setAddError(null);
    const targetMs = parseDateInput(addDate);
    if (targetMs === null) {
      setAddError("Pick a date first.");
      return;
    }
    if (targetMs <= now) {
      setAddError("That date already happened. Pick one that's still ahead of you.");
      return;
    }
    if (events.length >= MAX_EVENTS) {
      setAddError(`Keep it to ${MAX_EVENTS} events; remove one first.`);
      return;
    }
    const id = `evt-${targetMs}-${events.length}`;
    setEvents((prev) => [
      ...prev,
      { id, label: addLabel.trim().slice(0, 40), dateInput: addDate },
    ]);
    setSelectedId(id);
    setAddLabel("");
    setAddDate("");
  };

  const removeEvent = (id: string) =>
    setEvents((prev) => prev.filter((e) => e.id !== id));

  const displayLabel = featured?.label.trim() || "the big day";

  const doShare = async () => {
    if (!featured) return;
    setBusy(true);
    setFeedback(null);
    try {
      const canvas = await renderCountdownCard({
        span,
        label: displayLabel,
        countdown: featured.countdown,
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
      <h2 className="font-display text-3xl font-extrabold tracking-tight">
        Counting down to something?
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Put it on your grid. A date stops being abstract when you can see the
        weeks between here and there.
      </p>

      <div className="mt-5 grid max-w-lg grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input
          value={addLabel}
          onChange={(e) => setAddLabel(e.target.value.slice(0, 40))}
          onKeyDown={(e) => e.key === "Enter" && addEvent()}
          placeholder="What is it? (Kid turns 18...)"
          data-testid="countdown-label"
          className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm shadow-sm outline-none ring-primary/50 transition-shadow focus:ring-2"
        />
        <input
          type="date"
          value={addDate}
          onChange={(e) => setAddDate(e.target.value)}
          data-testid="countdown-date"
          className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm shadow-sm outline-none ring-primary/50 transition-shadow focus:ring-2"
        />
        <button
          type="button"
          data-testid="countdown-add"
          onClick={addEvent}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
      {addError && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {addError}
        </p>
      )}

      {upcoming.length > 1 && (
        <div className="mt-5 space-y-1.5" data-testid="countdown-events">
          {upcoming.map((e) => (
            <button
              key={e.id}
              type="button"
              data-testid={`countdown-event-${e.id}`}
              onClick={() => setSelectedId(e.id)}
              className={cn(
                "flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                e.id === featured?.id
                  ? "border-primary/60 bg-accent"
                  : "border-border bg-card hover:bg-accent/60",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: cssVarHsl(e.colorVar) }}
                />
                <span className="truncate font-medium">
                  {e.label.trim() || "the big day"}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {e.dateInput}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {e.countdown.boxesUntil.toLocaleString()} wks ·{" "}
                  {e.countdown.daysUntil.toLocaleString()} days
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${e.label.trim() || "event"}`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    removeEvent(e.id);
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.stopPropagation();
                      removeEvent(e.id);
                    }
                  }}
                  className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {featured && (
        <div className="mt-6 space-y-5">
          <div className="border-l-4 border-primary pl-5 sm:pl-6" data-testid="countdown-stats">
            <h3 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              <span className="text-primary">
                {featured.countdown.boxesUntil.toLocaleString()} weeks
              </span>{" "}
              until {displayLabel}.
            </h3>
            <p className="mt-3 font-mono text-sm tabular-nums text-muted-foreground">
              = {featured.countdown.daysUntil.toLocaleString()} days ·{" "}
              <strong className="text-foreground">
                {featured.countdown.percentOfRemainingWeeks.toFixed(1)}% of the
                weeks you have left
              </strong>
            </p>
            {featured.countdown.beyondGrid && (
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
              {upcoming.length > 1
                ? "Each color band ends at one of your dates. One box per week."
                : `The highlighted band is the stretch of your life between now and ${displayLabel}. One box per week.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="countdown-share"
              onClick={() => void doShare()}
              disabled={busy}
              className="flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
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
