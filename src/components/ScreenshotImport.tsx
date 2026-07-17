import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ClipboardCopy, Loader2, Plus, ShieldCheck, Upload } from "lucide-react";
import {
  getOcrDiagnostic,
  OcrError,
  OCR_ERROR_COPY,
  recognizeScreenTime,
} from "@/lib/ocr";
import { toHoursPerDay, type Period } from "@/lib/screentimeParse";
import { CUSTOM_COLOR_VARS, type SelectedHabit } from "@/lib/habits";
import { capHabitHours, type LifeSpan } from "@/lib/timeMath";
import { totalHours } from "@/lib/habits";
import { addCheckIn, loadCommitment } from "@/lib/storage";
import { cn, todayIso } from "@/lib/utils";

/** Fired after an import records a commitment check-in, so the reclaim
 * panel (a sibling, not a parent) can refresh its progress card. */
export const CHECKIN_EVENT = "weeks:checkin";

/** One row in the confirm card: parsed from OCR, or added by hand. */
interface EditableRow {
  appId: string | null;
  label: string;
  emoji: string;
  /** Duration as parsed, in the screenshot's period. Null for manual rows. */
  hoursInPeriod: number | null;
  /** User-edited hours/day. Takes precedence over the parsed value. */
  override: number | null;
  checked: boolean;
}

type Stage =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "confirm"; rows: EditableRow[]; period: Period; periodConfident: boolean }
  | { kind: "error"; message: string };

interface ScreenshotImportProps {
  span: LifeSpan;
  setHabits: React.Dispatch<React.SetStateAction<SelectedHabit[]>>;
}

/** Map a parsed app onto an existing preset id where possible. */
const PARSED_TO_PRESET: Record<string, string> = {
  instagram: "instagram",
};

const PARSED_COLOR: Record<string, string> = {
  instagram: "--event-rose",
  tiktok: "--event-violet",
  youtube: "--event-coral",
  x: "--event-sky",
  reddit: "--event-orange",
  netflix: "--event-amber",
};

function rowHoursPerDay(row: EditableRow, period: Period): number {
  if (row.override !== null) return row.override;
  if (row.hoursInPeriod === null) return 0;
  return toHoursPerDay(row.hoursInPeriod, period);
}

/** Small paired hours/minutes editor for a row's per-day value. */
function HmInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (hoursPerDay: number) => void;
  label: string;
}) {
  const h = Math.floor(value);
  const m = Math.round((value - h) * 60);
  const commit = (nh: number, nm: number) => {
    const safeH = Math.min(24, Math.max(0, Math.floor(nh) || 0));
    const safeM = Math.min(59, Math.max(0, Math.floor(nm) || 0));
    onChange(safeH + safeM / 60);
  };
  return (
    <span className="flex items-center gap-1 font-mono text-xs tabular-nums">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={24}
        value={h}
        aria-label={`${label} hours per day`}
        onChange={(e) => commit(Number(e.target.value), m)}
        className="w-11 rounded-md border border-input bg-background px-1.5 py-1 text-right outline-none focus:border-primary"
      />
      <span className="text-muted-foreground">h</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={59}
        step={5}
        value={m}
        aria-label={`${label} minutes per day`}
        onChange={(e) => commit(h, Number(e.target.value))}
        className="w-11 rounded-md border border-input bg-background px-1.5 py-1 text-right outline-none focus:border-primary"
      />
      <span className="text-muted-foreground">m/day</span>
    </span>
  );
}

export function ScreenshotImport({ span, setHabits }: ScreenshotImportProps) {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const [addName, setAddName] = useState("");
  const [addHours, setAddHours] = useState(1);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const copyDiagnostic = async () => {
    try {
      await navigator.clipboard.writeText(getOcrDiagnostic());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable: nothing to do */
    }
  };

  const handleFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    setStage({ kind: "reading" });
    try {
      const result = await recognizeScreenTime(file);
      setStage({
        kind: "confirm",
        period: result.guessedPeriod,
        periodConfident: result.periodConfident,
        rows: result.apps.map((app) => ({
          appId: app.appId,
          label: app.label,
          emoji: app.emoji,
          hoursInPeriod: app.hoursInPeriod,
          override: null,
          checked: true,
        })),
      });
    } catch (e) {
      const reason = e instanceof OcrError ? e.reason : "unreadable";
      setStage({ kind: "error", message: OCR_ERROR_COPY[reason] });
    }
  }, []);

  // The dropzone advertises paste; accept a screenshot pasted anywhere on the
  // page while the dropzone is showing (but not while the user is typing).
  useEffect(() => {
    if (stage.kind !== "idle") return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(input|textarea)$/i.test(target.tagName)) return;
      const file = Array.from(e.clipboardData?.items ?? [])
        .find((item) => item.kind === "file" && item.type.startsWith("image/"))
        ?.getAsFile();
      if (!file) return;
      e.preventDefault();
      void handleFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [stage.kind, handleFile]);

  const updateRow = (index: number, patch: Partial<EditableRow>) => {
    setStage((s) =>
      s.kind === "confirm"
        ? {
            ...s,
            rows: s.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
          }
        : s,
    );
  };

  const addManualRow = () => {
    const name = addName.trim().slice(0, 24);
    if (name.length < 2 || stage.kind !== "confirm") return;
    if (stage.rows.some((r) => r.label.toLowerCase() === name.toLowerCase()))
      return;
    setStage({
      ...stage,
      rows: [
        ...stage.rows,
        {
          appId: null,
          label: name,
          emoji: "📲",
          hoursInPeriod: null,
          override: Math.max(1 / 12, addHours),
          checked: true,
        },
      ],
    });
    setAddName("");
    setAddHours(1);
  };

  const applyConfirmed = () => {
    if (stage.kind !== "confirm") return;
    const { rows, period } = stage;

    // A screenshot is evidence: when a commitment exists, record today's
    // observed hours for the imported apps as a check-in.
    const observed: Record<string, number> = {};
    for (const row of rows) {
      if (!row.checked) continue;
      const hoursPerDay = rowHoursPerDay(row, period);
      if (hoursPerDay <= 0) continue;
      const id =
        (row.appId && PARSED_TO_PRESET[row.appId]) ??
        `app-${(row.appId ?? row.label).toLowerCase().replace(/\s+/g, "-")}`;
      observed[id] = hoursPerDay;
    }
    if (loadCommitment() && Object.keys(observed).length > 0) {
      addCheckIn({ date: todayIso(), hours: observed });
      window.dispatchEvent(new CustomEvent(CHECKIN_EVENT));
    }

    setHabits((prev) => {
      const next = [...prev];
      let colorCursor = 0;
      for (const row of rows) {
        if (!row.checked) continue;
        const hoursPerDay = rowHoursPerDay(row, period);
        if (hoursPerDay <= 0) continue;

        const id =
          (row.appId && PARSED_TO_PRESET[row.appId]) ??
          `app-${(row.appId ?? row.label).toLowerCase().replace(/\s+/g, "-")}`;
        const colorVar =
          (row.appId && PARSED_COLOR[row.appId]) ??
          CUSTOM_COLOR_VARS[colorCursor++ % CUSTOM_COLOR_VARS.length];

        const existingIdx = next.findIndex((h) => h.id === id);
        const others = totalHours(next.filter((_, idx) => idx !== existingIdx));
        const { hours } = capHabitHours(hoursPerDay, others, span.wakingHoursPerDay);
        if (hours <= 0) continue;

        const habit: SelectedHabit = {
          id,
          label: row.label,
          emoji: row.emoji,
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
              role="status"
            >
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>
                Reading on your device…{" "}
                <span className="text-muted-foreground">
                  this image never leaves your phone. First time? The reader
                  downloads once (~25 MB) and is cached after.
                </span>
              </span>
            </div>
          )}

          {stage.kind === "error" && (
            <div className="mt-3 space-y-2" data-testid="ocr-error">
              <p className="text-sm text-destructive">{stage.message}</p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStage({ kind: "idle" })}
                  className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  Try another screenshot
                </button>
                <button
                  type="button"
                  data-testid="ocr-copy-diagnostic"
                  onClick={() => void copyDiagnostic()}
                  className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  <ClipboardCopy className="h-3 w-3" />
                  {copied ? "Copied" : "Copy what the reader saw"}
                </button>
              </div>
            </div>
          )}

          {stage.kind === "confirm" && (
            <div className="mt-3 animate-scale-in space-y-3" data-testid="ocr-confirm">
              <p className="text-sm font-medium">
                Found in your screenshot. Fix anything we misread:
              </p>

              <div
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-lg p-2.5 text-xs",
                  stage.periodConfident ? "bg-accent/60" : "bg-event-amber/10",
                )}
              >
                <span
                  className={cn(
                    "font-medium",
                    !stage.periodConfident && "text-event-amber",
                  )}
                >
                  {stage.periodConfident
                    ? "These times are per:"
                    : "Are these daily or weekly totals? We guessed:"}
                </span>
                {(["day", "week"] as Period[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    data-testid={`period-${p}`}
                    onClick={() =>
                      setStage((s) => (s.kind === "confirm" ? { ...s, period: p } : s))
                    }
                    className={cn(
                      "rounded-full border px-3 py-1 font-mono font-semibold uppercase tracking-wider transition-colors",
                      stage.period === p
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p}
                  </button>
                ))}
                <span className="text-muted-foreground">
                  Flipping re-converts every row you haven't edited.
                </span>
              </div>

              <div className="space-y-1.5">
                {stage.rows.map((row, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    data-testid={`ocr-row-${i}`}
                  >
                    <label className="flex min-w-0 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.checked}
                        onChange={(e) => updateRow(i, { checked: e.target.checked })}
                        className="accent-primary"
                      />
                      <span className="truncate">
                        {row.emoji} {row.label}
                      </span>
                    </label>
                    <HmInput
                      label={row.label}
                      value={rowHoursPerDay(row, stage.period)}
                      onChange={(v) => updateRow(i, { override: v })}
                    />
                  </div>
                ))}
              </div>

              <div
                className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2"
                data-testid="ocr-add-row"
              >
                <input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addManualRow()}
                  placeholder="We missed one? Name it"
                  maxLength={24}
                  className="w-40 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:border-primary"
                />
                <HmInput
                  label="new app"
                  value={addHours}
                  onChange={setAddHours}
                />
                <button
                  type="button"
                  data-testid="ocr-add-button"
                  onClick={addManualRow}
                  className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="ocr-apply"
                  onClick={applyConfirmed}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  Use these ({stage.rows.filter((r) => r.checked && rowHoursPerDay(r, stage.period) > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setStage({ kind: "idle" })}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
              <p className="flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
                <span>Editing a value pins it. Values are minute-exact.</span>
                <button
                  type="button"
                  data-testid="ocr-copy-diagnostic"
                  onClick={() => void copyDiagnostic()}
                  className="flex items-center gap-1 underline-offset-2 hover:underline"
                >
                  <ClipboardCopy className="h-3 w-3" />
                  {copied ? "Copied" : "Numbers look wrong? Copy what the reader saw"}
                </button>
              </p>
            </div>
          )}

          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-event-emerald" />
            Parsed entirely in your browser. The image is never uploaded.
          </p>
        </div>
      </div>
    </div>
  );
}
