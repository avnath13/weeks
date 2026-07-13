/** Preset habits with research-backed default hours/day and grid colors. */

export interface HabitPreset {
  id: string;
  label: string;
  emoji: string;
  /** Default hours per day (research-backed averages). */
  defaultHours: number;
  /** CSS variable name (from the bigpicture event palette). */
  colorVar: string;
  sourceNote: string;
}

export const HABIT_PRESETS: HabitPreset[] = [
  {
    id: "scrolling",
    label: "Scrolling",
    emoji: "📱",
    defaultHours: 4.5,
    colorVar: "--event-coral",
    sourceNote: "Avg. US adult mobile screen time ≈ 4.5h/day",
  },
  {
    id: "instagram",
    label: "Instagram",
    emoji: "📸",
    defaultHours: 2.5,
    colorVar: "--event-rose",
    sourceNote: "Heavy-user average ≈ 2.5h/day",
  },
  {
    id: "commute",
    label: "Commute",
    emoji: "🚗",
    defaultHours: 0.7,
    colorVar: "--event-teal",
    sourceNote: "US avg 27.6 min each way, 5 days/wk",
  },
  {
    id: "meetings",
    label: "Meetings",
    emoji: "💼",
    defaultHours: 2.1,
    colorVar: "--event-sky",
    sourceNote: "≈ 3h/workday → 2.1h/day averaged over the week",
  },
];

/** Palette assigned to custom (user-added) habits, cycled in order. */
export const CUSTOM_COLOR_VARS = [
  "--event-orange",
  "--event-slate",
  "--event-emerald",
  "--event-violet",
  "--event-sky",
];

export interface SelectedHabit {
  id: string;
  label: string;
  emoji: string;
  colorVar: string;
  hoursPerDay: number;
  /** Reclaim-mode target hours per day (defaults to hoursPerDay). */
  reclaimHours: number;
}

export function presetToSelected(p: HabitPreset): SelectedHabit {
  return {
    id: p.id,
    label: p.label,
    emoji: p.emoji,
    colorVar: p.colorVar,
    hoursPerDay: p.defaultHours,
    reclaimHours: p.defaultHours,
  };
}

export function totalHours(habits: SelectedHabit[]): number {
  return habits.reduce((sum, h) => sum + h.hoursPerDay, 0);
}
