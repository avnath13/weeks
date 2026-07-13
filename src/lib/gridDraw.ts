import type { LifeSpan } from "./timeMath";
import { habitCost } from "./timeMath";
import type { SelectedHabit } from "./habits";

/**
 * Shared canvas grid renderer — used by the on-screen LifeGrid and the
 * exported share card so the two can never drift apart.
 */

export const GRID_COLS = 52; // one row ≈ one year

export interface GridSegment {
  /** Index of the first week cell this segment covers. */
  startWeek: number;
  count: number;
  color: string;
}

export interface GridColors {
  lived: string;
  remaining: string;
  currentWeek: string;
}

/** Read an HSL triplet CSS variable (e.g. "12 83% 62%") as a color string. */
export function cssVarHsl(name: string, alpha = 1): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!raw) return alpha === 1 ? "hsl(220 9% 46%)" : `hsl(220 9% 46% / ${alpha})`;
  return alpha === 1 ? `hsl(${raw})` : `hsl(${raw} / ${alpha})`;
}

/**
 * Habit bands are painted from the END of life backwards — the "these years
 * are effectively erased" framing. Returns segments in draw order, plus the
 * emerald "reclaimed" band when reclaim mode has freed weeks.
 */
export function habitSegments(
  span: LifeSpan,
  habits: SelectedHabit[],
  reclaimMode: boolean,
): GridSegment[] {
  const segments: GridSegment[] = [];
  let cursor = span.totalWeeks;

  // Active cost per habit (reclaim mode uses the reduced target hours).
  const active = habits
    .map((h) => ({
      habit: h,
      weeks: Math.round(
        habitCost(reclaimMode ? h.reclaimHours : h.hoursPerDay, span).weeks,
      ),
    }))
    .filter((e) => e.weeks > 0);

  const totalActive = active.reduce((s, e) => s + e.weeks, 0);
  const capped = Math.min(totalActive, span.remainingWeeks);
  const scale = totalActive > 0 ? capped / totalActive : 0;

  for (const entry of active) {
    const count = Math.round(entry.weeks * scale);
    if (count <= 0) continue;
    cursor -= count;
    segments.push({
      startWeek: Math.max(span.livedWeeks, cursor),
      count,
      color: cssVarHsl(entry.habit.colorVar, 0.9),
    });
  }

  if (reclaimMode) {
    const originalWeeks = Math.min(
      span.remainingWeeks,
      habits.reduce(
        (s, h) => s + Math.round(habitCost(h.hoursPerDay, span).weeks),
        0,
      ),
    );
    const reclaimed = Math.max(0, originalWeeks - capped);
    if (reclaimed > 0) {
      cursor -= reclaimed;
      segments.push({
        startWeek: Math.max(span.livedWeeks, cursor),
        count: reclaimed,
        color: cssVarHsl("--event-emerald", 0.55),
      });
    }
  }

  return segments;
}

export interface DrawOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0–1: how much of the animation has played (1 = fully drawn). */
  progress?: number;
  showCurrentWeekPulse?: boolean;
}

/**
 * Draw the full life grid into `ctx`. Cell size is derived from the rect and
 * total row count; the grid is centered horizontally within the rect.
 */
export function drawLifeGrid(
  ctx: CanvasRenderingContext2D,
  span: LifeSpan,
  segments: GridSegment[],
  colors: GridColors,
  opts: DrawOptions,
): void {
  const rows = Math.ceil(span.totalWeeks / GRID_COLS);
  const gapRatio = 0.25;
  const cellW = opts.width / (GRID_COLS + (GRID_COLS - 1) * gapRatio);
  const cellH = opts.height / (rows + (rows - 1) * gapRatio);
  const cell = Math.min(cellW, cellH);
  const gap = cell * gapRatio;
  const gridW = GRID_COLS * cell + (GRID_COLS - 1) * gap;
  const offsetX = opts.x + (opts.width - gridW) / 2;
  const offsetY = opts.y;
  const progress = opts.progress ?? 1;

  // Segment lookup: weekIndex -> color. Later segments win (reclaim band).
  const segColor = new Map<number, string>();
  for (const seg of segments) {
    for (let i = 0; i < seg.count; i++) {
      const wk = seg.startWeek + i;
      if (wk >= 0 && wk < span.totalWeeks) segColor.set(wk, seg.color);
    }
  }

  const visibleWeeks = Math.floor(span.totalWeeks * progress);
  const radius = Math.max(0.5, cell * 0.22);

  for (let wk = 0; wk < span.totalWeeks; wk++) {
    const col = wk % GRID_COLS;
    const row = Math.floor(wk / GRID_COLS);
    const px = offsetX + col * (cell + gap);
    const py = offsetY + row * (cell + gap);

    let fill: string;
    if (wk >= visibleWeeks) {
      fill = colors.remaining;
    } else if (segColor.has(wk)) {
      fill = segColor.get(wk)!;
    } else if (wk < span.livedWeeks) {
      fill = colors.lived;
    } else {
      fill = colors.remaining;
    }

    ctx.fillStyle = fill;
    roundRect(ctx, px, py, cell, cell, radius);
    ctx.fill();
  }

  // Current-week highlight ring.
  if (opts.showCurrentWeekPulse && !span.onBonusTime && progress >= 1) {
    const wk = Math.min(span.totalWeeks - 1, span.livedWeeks);
    const col = wk % GRID_COLS;
    const row = Math.floor(wk / GRID_COLS);
    ctx.strokeStyle = colors.currentWeek;
    ctx.lineWidth = Math.max(1, cell * 0.18);
    roundRect(
      ctx,
      offsetX + col * (cell + gap) - gap / 2,
      offsetY + row * (cell + gap) - gap / 2,
      cell + gap,
      cell + gap,
      radius,
    );
    ctx.stroke();
  }
}

export function gridPixelHeight(
  span: LifeSpan,
  width: number,
): number {
  const rows = Math.ceil(span.totalWeeks / GRID_COLS);
  const gapRatio = 0.25;
  const cell = width / (GRID_COLS + (GRID_COLS - 1) * gapRatio);
  return rows * cell + (rows - 1) * cell * gapRatio;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
