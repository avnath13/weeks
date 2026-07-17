import { MS_PER_DAY, type LifeSpan } from "./timeMath";

/**
 * Reclaim commitments: the user pins a target ("Instagram 2.5h -> 1h") and
 * later logs check-ins (screenshot re-imports or manual logs). Progress is
 * computed from evidence only - days before the first check-in earn no
 * credit, so the banked number can't flatter.
 */

export interface CommitmentTarget {
  /** Habit id, matching SelectedHabit.id (presets and app-<name> ids). */
  id: string;
  label: string;
  emoji: string;
  colorVar: string;
  /** Hours/day when the commitment was made. */
  fromHours: number;
  /** Committed hours/day ceiling. */
  toHours: number;
}

export interface Commitment {
  /** YYYY-MM-DD the commitment was made. */
  startedAt: string;
  targets: CommitmentTarget[];
}

export interface CheckIn {
  /** YYYY-MM-DD of the observation. */
  date: string;
  /** Habit id -> observed hours/day. */
  hours: Record<string, number>;
}

export interface TargetProgress extends CommitmentTarget {
  /** Most recent observed hours/day, or null before any check-in. */
  latestHours: number | null;
  /** True when the latest observation is at or under the committed ceiling. */
  onTrack: boolean | null;
  /** Waking weeks banked by this habit so far (evidence-based). */
  weeksBanked: number;
}

export interface CommitmentProgress {
  daysSinceStart: number;
  checkInCount: number;
  targets: TargetProgress[];
  totalWeeksBanked: number;
}

function dateMs(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/**
 * Evidence-based progress. Each check-in's observed rate is assumed to hold
 * from its date until the next check-in (or today); saved time is
 * max(0, fromHours - observed) over that stretch, converted to waking weeks.
 */
export function commitmentProgress(
  commitment: Commitment,
  checkIns: CheckIn[],
  span: LifeSpan,
  now: number,
): CommitmentProgress {
  const startMs = dateMs(commitment.startedAt);
  const daysSinceStart = Math.max(0, Math.floor((now - startMs) / MS_PER_DAY));
  const sorted = [...checkIns]
    .filter((c) => Number.isFinite(dateMs(c.date)))
    .sort((a, b) => dateMs(a.date) - dateMs(b.date));

  const wakingWeekHours = Math.max(1, span.wakingHoursPerDay * 7);

  const targets: TargetProgress[] = commitment.targets.map((t) => {
    let savedHours = 0;
    let latestHours: number | null = null;
    for (let i = 0; i < sorted.length; i++) {
      const observed = sorted[i].hours[t.id];
      if (typeof observed !== "number" || !Number.isFinite(observed)) continue;
      latestHours = observed;
      const segStart = Math.max(dateMs(sorted[i].date), startMs);
      const segEnd = i + 1 < sorted.length ? dateMs(sorted[i + 1].date) : now;
      const segDays = Math.max(0, (segEnd - segStart) / MS_PER_DAY);
      savedHours += Math.max(0, t.fromHours - observed) * segDays;
    }
    return {
      ...t,
      latestHours,
      onTrack: latestHours === null ? null : latestHours <= t.toHours + 1e-9,
      weeksBanked: savedHours / wakingWeekHours,
    };
  });

  return {
    daysSinceStart,
    checkInCount: sorted.length,
    targets,
    totalWeeksBanked: targets.reduce((s, t) => s + t.weeksBanked, 0),
  };
}

/** Format banked weeks for display: days under a week, else weeks. */
export function formatBanked(weeks: number): string {
  const days = weeks * 7;
  if (days < 1) {
    const hours = days * 24;
    return hours < 1 ? "under an hour" : `${Math.round(hours)}h`;
  }
  if (weeks < 1) return `${days.toFixed(1)} days`;
  return `${weeks.toFixed(1)} weeks`;
}
