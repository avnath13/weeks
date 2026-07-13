import { useCallback, useRef, useState } from "react";
import { Camera, Loader2, ShieldCheck, Upload } from "lucide-react";
import { OcrError, OCR_ERROR_COPY, recognizeScreenTime } from "@/lib/ocr";
import {
  toHoursPerDay,
  type ParseResult,
  type Period,
} from "@/lib/screentimeParse";
import { CUSTOM_COLOR_VARS, type SelectedHabit } from "@/lib/habits";
import { capHabitHours, formatHoursPerDay, type LifeSpan } from "@/lib/timeMath";
import { totalHours } from "@/lib/habits";
import { cn } from "@/lib/utils";

type Stage =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "confirm"; result: ParseResult; period: Period; checked: Set<number> }
  | { kind: "error"; message: string };

interface ScreenshotImportProps {
  span: LifeSpan;
  setHabits: React.Dispatch<React.SetStateAction<SelectedHabit[]>>;
}

/** Map a parsed app onto an existing preset id where possible. */
const PARSED_TO_PRESET: Record<string, string> = {
  instagram: "instagram",
  tiktok: "tiktok",
};

const PARSED_COLOR: Record<string, string> = {
  instagram: "--event-rose",
  tiktok: "--event-violet",
  youtube: "--event-coral",
  x: "--event-sky",
  reddit: "--event-orange",
  netflix: "--event-amber",
};

export function ScreenshotImport({ span, setHabits }: ScreenshotImportProps) {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    setStage({ kind: "reading" });
    try {
      const result = await recognizeScreenTime(file);
      setStage({
        kind: "confirm",
        result,
        period: result.guessedPeriod,
        checked: new Set(result.apps.map((_, i) => i)),
      });
    } catch (e) {
      const reason = e instanceof OcrError ? e.reason : "unreadable";
      setStage({ kind: "error", message: OCR_ERROR_COPY[reason] });
    }
  }, []);

  const applyConfirmed = () => {
    if (stage.kind !== "confirm") return;
    const { result, period, checked } = stage;
    setHabits((prev) => {
      let next = [...prev];
      let colorCursor = 0;
      for (const [i, app] of result.apps.entries()) {
        if (!checked.has(i)) continue;
        const hoursPerDay = toHoursPerDay(app.hoursInPeriod, period);
        if (hoursPerDay <= 0) continue;

        const id =
          (app.appId && PARSED_TO_PRESET[app.appId]) ??
          `app-${(app.appId ?? app.label).toLowerCase().replace(/\s+/g, "-")}`;
        const colorVar =
          (app.appId && PARSED_COLOR[app.appId]) ??
          CUSTOM_COLOR_VARS[colorCursor++ % CUSTOM_COLOR_VARS.length];

        const existingIdx = next.findIndex((h) => h.id === id);
        const others = totalHours(
          next.filter((_, idx) => idx !== existingIdx),
        );
        const { hours } = capHabitHours(hoursPerDay, others, span.wakingHoursPerDay);
        if (hours <= 0) continue;

        const habit: SelectedHabit = {
          id,
          label: app.label,
          emoji: app.emoji,
          colorVar,
          hoursPerDay: hours,
          reclaimHours: hours,
        };
        if (existingIdx >= 0) next[existingIdx] = habit;
        else next.push(habit);
      }
      return next;
    });
    setStage({ kind: "idle" });
  };

  return (
    <div className="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-4">
      <div className="flex items-start gap-3">
        <Camera className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">
            Have your real numbers? Use your Screen Time screenshot.
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            iPhone: Settings → Screen Time → See All App &amp; Website Activity.
            Android: Settings → Digital Wellbeing. Screenshot the app list, drop
            it here.
          </p>

          {stage.kind === "idle" && (
            <div
              data-testid="ocr-dropzone"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void handleFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "mt-3 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-5 text-center transition-colors sm:flex-row sm:justify-between sm:text-left",
                dragOver ? "border-primary bg-accent" : "border-border",
              )}
            >
              <p className="text-xs text-muted-foreground">
                Drag &amp; drop, paste, or
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <Upload className="h-4 w-4" /> Choose screenshot
              </button>
              <input
                ref={inputRef}
                data-testid="ocr-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/heic"
                className="hidden"
                onChange={(e) => {
                  void handleFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          )}

          {stage.kind === "reading" && (
            <div
              className="mt-3 flex items-center gap-2.5 rounded-lg bg-accent p-4 text-sm"
              data-testid="ocr-reading"
            >
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>
                Reading on your device…{" "}
                <span className="text-muted-foreground">
                  this image never leaves your phone.
                </span>
              </span>
            </div>
          )}

          {stage.kind === "error" && (
            <div className="mt-3 space-y-2" data-testid="ocr-error">
              <p className="text-sm text-destructive">{stage.message}</p>
              <button
                type="button"
                onClick={() => setStage({ kind: "idle" })}
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                Try another screenshot
              </button>
            </div>
          )}

          {stage.kind === "confirm" && (
            <div className="mt-3 animate-scale-in space-y-3" data-testid="ocr-confirm">
              <p className="text-sm font-medium">Found in your screenshot:</p>
              <div className="space-y-1.5">
                {stage.result.apps.map((app, i) => (
                  <label
                    key={i}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={stage.checked.has(i)}
                        onChange={(e) => {
                          const next = new Set(stage.checked);
                          if (e.target.checked) next.add(i);
                          else next.delete(i);
                          setStage({ ...stage, checked: next });
                        }}
                        className="accent-primary"
                      />
                      {app.emoji} {app.label}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {formatHoursPerDay(toHoursPerDay(app.hoursInPeriod, stage.period))}
                      /day
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">These numbers are per:</span>
                {(["day", "week"] as Period[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    data-testid={`period-${p}`}
                    onClick={() => setStage({ ...stage, period: p })}
                    className={cn(
                      "rounded-full px-3 py-1 font-medium transition-colors",
                      stage.period === p
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    {p}
                  </button>
                ))}
                {!stage.result.periodConfident && (
                  <span className="text-muted-foreground">(our best guess)</span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="ocr-apply"
                  onClick={applyConfirmed}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm"
                >
                  Looks right - use these
                </button>
                <button
                  type="button"
                  onClick={() => setStage({ kind: "idle" })}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-event-emerald" />
            Parsed entirely in your browser - the image is never uploaded.
          </p>
        </div>
      </div>
    </div>
  );
}
