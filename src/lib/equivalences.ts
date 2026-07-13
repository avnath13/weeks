import type { HabitCost } from "./timeMath";

/**
 * Rotating "lived experience" equivalences for a habit's total cost.
 * One is shown at a time (auto-picked, shuffle on tap) — a list reads as a
 * lecture, one reads as a revelation.
 */

export interface Equivalence {
  text: string;
}

const WEEKS_PER_SUMMER = 13;
const HOURS_PER_BOOK = 6;
const HOURS_PER_MOVIE = 2;
const WEEKS_ROUND_WORLD_TRIP = 3;

export function buildEquivalences(cost: HabitCost, label: string): Equivalence[] {
  const out: Equivalence[] = [];
  const summers = cost.weeks / WEEKS_PER_SUMMER;
  const books = cost.totalHours / HOURS_PER_BOOK;
  const movies = cost.totalHours / HOURS_PER_MOVIE;
  const trips = cost.weeks / WEEKS_ROUND_WORLD_TRIP;

  if (summers >= 1)
    out.push({
      text: `${label} = ${Math.round(summers).toLocaleString()} entire summers`,
    });
  if (books >= 10)
    out.push({
      text: `${label} = ~${roundNice(books)} books you could have read`,
    });
  if (movies >= 20)
    out.push({
      text: `${label} = ~${roundNice(movies)} movies, back to back`,
    });
  if (trips >= 2)
    out.push({
      text: `${label} = ${Math.round(trips).toLocaleString()} three-week trips around the world`,
    });
  return out;
}

function roundNice(n: number): string {
  if (n >= 1000) return `${Math.round(n / 100) * 100}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (n >= 100) return `${Math.round(n / 10) * 10}`;
  return `${Math.round(n)}`;
}
