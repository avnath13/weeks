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
}

export function HabitPicker({ habits, setHabits, span }: HabitPickerProps) {
  const [customName, setCustomName] = useState("");
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
          `${preset.label} was capped at ${formatHoursPerDay(hours)} - your habits can't exceed your ${span.wakingHoursPerDay} waking hours.`,
        );
      if (hours <= 0) {
        setCapWarning(
          `No waking hours left for ${preset.label} - reduce another habit first.`,
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
            `Capped at ${formatHoursPerDay(hours)} - your habits can't exceed your ${span.wakingHoursPerDay} waking hours.`,
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
      const { hours } = capHabitHours(1, totalHours(prev), span.wakingHoursPerDay);
      if (hours <= 0) {
        setCapWarning("No waking hours left - reduce another habit first.");
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
    setShowCustom(false);
  };

  return (
    <section className="animate-fade-in-up">
      <h2 className="font-display text-2xl font-bold tracking-tight">
        Where do your waking hours go?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tap a habit - averages are pre-filled, drag to match your reality.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {HABIT_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            data-testid={`habit-chip-${p.id}`}
            onClick={() => toggle(p.id)}
            aria-pressed={isSelected(p.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
              isSelected(p.id)
                ? "border-transparent text-white shadow-sm"
                : "border-border bg-card text-foreground hover:bg-accent",
            )}
            style={
              isSelected(p.id)
                ? { backgroundColor: cssVarHsl(p.colorVar) }
                : undefined
            }
          >
            <span>{p.emoji}</span>
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom((s) => !s)}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
        >
          <Plus className="h-3.5 w-3.5" /> Custom
        </button>
      </div>

      {showCustom && (
        <div className="mt-3 flex max-w-xs gap-2 animate-scale-in">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            placeholder="Name it (e.g. News)"
            maxLength={24}
            className="w-full rounded-lg border border-input bg-card px-3 py-1.5 text-sm outline-none ring-primary/50 focus:ring-2"
          />
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
        <div className="mt-5 space-y-3">
          {habits.map((h) => (
            <div
              key={h.id}
              className="rounded-lg border border-border bg-card p-3"
              data-testid={`habit-row-${h.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: cssVarHsl(h.colorVar) }}
                  />
                  {h.emoji} {h.label}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {formatHoursPerDay(h.hoursPerDay)}/day
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${h.label}`}
                    onClick={() =>
                      setHabits((prev) => prev.filter((x) => x.id !== h.id))
                    }
                    className="text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0.25}
                max={Math.min(12, span.wakingHoursPerDay)}
                step={0.25}
                value={h.hoursPerDay}
                onChange={(e) => setHours(h.id, Number(e.target.value))}
                aria-label={`${h.label} hours per day`}
                className="mt-2 w-full accent-primary"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
