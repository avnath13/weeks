import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  CUSTOM_COLOR_VARS,
  HABIT_PRESETS,
  presetToSelected,
  totalHours,
  type SelectedHabit,
} from "@/lib/habits";
import { capHabitHours, formatHoursPerDay, type LifeSpan } from "@/lib/timeMath";
import { cssVarHsl } from "@/lib/gridDraw";
import { cn } from "@/lib/utils";

interface HabitPickerProps {
  habits: SelectedHabit[];
  setHabits: React.Dispatch<React.SetStateAction<SelectedHabit[]>>;
  span: LifeSpan;
  hiddenChips: string[];
  onDeleteChip: (id: string) => void;
}

export function HabitPicker({
  habits,
  setHabits,
  span,
  hiddenChips,
  onDeleteChip,
}: HabitPickerProps) {
  const [customName, setCustomName] = useState("");
  const [customHours, setCustomHours] = useState(1);
  const [showCustom, setShowCustom] = useState(false);
  const [capWarning, setCapWarning] = useState<string | null>(null);

  const isSelected = (id: string) => habits.some((h) => h.id === id);

  const toggle = (presetId: string) => {
    setCapWarning(null);
    setHabits((prev) => {
      const existing = prev.find((h) => h.id === presetId);
      if (existing) return prev.filter((h) => h.id !== presetId);
      const preset = HABIT_PRESETS.find((p) => p.id === presetId)!;
      const selected = presetToSelected(preset);
      const { hours, capped } = capHabitHours(
        selected.hoursPerDay,
        totalHours(prev),
        span.wakingHoursPerDay,
      );
      if (capped)
        setCapWarning(
          `${preset.label} was capped at ${formatHoursPerDay(hours)}. Your habits can't exceed your ${span.wakingHoursPerDay} waking hours.`,
        );
      if (hours <= 0) {
        setCapWarning(
          `No waking hours left for ${preset.label}. Reduce another habit first.`,
        );
        return prev;
      }
      return [...prev, { ...selected, hoursPerDay: hours, reclaimHours: hours }];
    });
  };

  const setHours = (id: string, requested: number) => {
    setCapWarning(null);
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const others = totalHours(prev.filter((o) => o.id !== id));
        const { hours, capped } = capHabitHours(
          requested,
          others,
          span.wakingHoursPerDay,
        );
        if (capped)
          setCapWarning(
            `Capped at ${formatHoursPerDay(hours)}. Your habits can't exceed your ${span.wakingHoursPerDay} waking hours.`,
          );
        return {
          ...h,
          hoursPerDay: hours,
          reclaimHours: Math.min(h.reclaimHours, hours),
        };
      }),
    );
  };

  const addCustom = () => {
    const name = customName.trim().slice(0, 24);
    if (name.length < 2) return;
    setHabits((prev) => {
      if (prev.some((h) => h.label.toLowerCase() === name.toLowerCase()))
        return prev;
      const colorVar =
        CUSTOM_COLOR_VARS[prev.length % CUSTOM_COLOR_VARS.length];
      const requested = Math.min(12, Math.max(0.25, customHours || 1));
      const { hours } = capHabitHours(
        requested,
        totalHours(prev),
        span.wakingHoursPerDay,
      );
      if (hours <= 0) {
        setCapWarning("No waking hours left. Reduce another habit first.");
        return prev;
      }
      return [
        ...prev,
        {
          id: `custom-${name.toLowerCase().replace(/\s+/g, "-")}`,
          label: name,
          emoji: "⏳",
          colorVar,
          hoursPerDay: hours,
          reclaimHours: hours,
        },
      ];
    });
    setCustomName("");
    setCustomHours(1);
    setShowCustom(false);
  };

  return (
    <section className="animate-fade-in-up">
      <h2 className="font-display text-3xl font-extrabold tracking-tight">
        Where do your waking hours go?
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Tap a habit. Averages are pre-filled; drag until it matches your
        reality.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {HABIT_PRESETS.filter((p) => !hiddenChips.includes(p.id)).map((p) => (
          <div
            key={p.id}
            className={cn(
              "flex items-center rounded-full border font-mono text-xs font-semibold uppercase tracking-wider transition-all",
              isSelected(p.id)
                ? "border-transparent text-white shadow-sm"
                : "border-border bg-card text-muted-foreground",
            )}
            style={
              isSelected(p.id)
                ? { backgroundColor: cssVarHsl(p.colorVar) }
                : undefined
            }
          >
            <button
              type="button"
              data-testid={`habit-chip-${p.id}`}
              onClick={() => toggle(p.id)}
              aria-pressed={isSelected(p.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-l-full py-1.5 pl-3.5 pr-1",
                !isSelected(p.id) && "hover:text-foreground",
              )}
            >
              <span>{p.emoji}</span>
              {p.label}
            </button>
            <button
              type="button"
              aria-label={`Delete ${p.label} chip`}
              data-testid={`habit-chip-delete-${p.id}`}
              onClick={() => onDeleteChip(p.id)}
              className={cn(
                "rounded-r-full py-1.5 pl-1 pr-2.5 transition-opacity",
                isSelected(p.id)
                  ? "text-white/70 hover:text-white"
                  : "text-muted-foreground/50 hover:text-destructive",
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom((s) => !s)}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-3.5 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Custom
        </button>
      </div>

      {showCustom && (
        <div className="mt-3 flex max-w-md flex-wrap items-center gap-2 animate-scale-in">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            placeholder="Name it (e.g. News)"
            maxLength={24}
            className="w-40 flex-1 rounded-lg border border-input bg-card px-3 py-1.5 text-sm outline-none ring-primary/50 focus:ring-2"
          />
          <label className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
            <input
              type="number"
              inputMode="decimal"
              min={0.25}
              max={12}
              step={0.25}
              value={customHours}
              onChange={(e) => setCustomHours(Number(e.target.value))}
              aria-label="Hours per day for the new habit"
              className="w-16 rounded-lg border border-input bg-card px-2 py-1.5 text-right text-sm outline-none ring-primary/50 focus:ring-2"
            />
            <span className="text-muted-foreground">h/day</span>
          </label>
          <button
            type="button"
            onClick={addCustom}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Add
          </button>
        </div>
      )}

      {capWarning && (
        <p className="mt-3 text-sm text-event-amber" role="alert">
          {capWarning}
        </p>
      )}

      {habits.length > 0 && (
        <div className="mt-6 border-t border-border">
          {habits.map((h) => (
            <div
              key={h.id}
              className="border-b border-border py-3.5"
              data-testid={`habit-row-${h.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-[3px]"
                    style={{ backgroundColor: cssVarHsl(h.colorVar) }}
                  />
                  {h.emoji} {h.label}
                </span>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-sm font-bold tabular-nums">
                    {formatHoursPerDay(h.hoursPerDay)}
                    <span className="font-medium text-muted-foreground">/day</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${h.label}`}
                    onClick={() =>
                      setHabits((prev) => prev.filter((x) => x.id !== h.id))
                    }
                    className="text-muted-foreground/60 transition-colors hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={1 / 12}
                max={Math.min(12, span.wakingHoursPerDay)}
                step={1 / 12}
                value={h.hoursPerDay}
                onChange={(e) => setHours(h.id, Number(e.target.value))}
                aria-label={`${h.label} hours per day`}
                className="slider mt-3"
                style={{ "--range-color": cssVarHsl(h.colorVar) } as React.CSSProperties}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
