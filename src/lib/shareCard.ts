import type { Countdown, LifeSpan } from "./timeMath";
import { formatLadder, habitCost, reclaimedWeeks } from "./timeMath";
import type { SelectedHabit } from "./habits";
import { drawLifeGrid, habitSegments, cssVarHsl } from "./gridDraw";

/**
 * Share-card renderer. Draws directly to canvas (deterministic - no
 * DOM-to-image quirks). Cards are always rendered on the dark theme for a
 * consistent brand in feeds, regardless of the user's current theme.
 */

export type CardFormat = "story" | "og";

const FORMATS: Record<CardFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  og: { w: 1200, h: 630 },
};

export interface CardData {
  span: LifeSpan;
  habits: SelectedHabit[];
  reclaimMode: boolean;
  sleepHours: number;
  lifeExpectancy: number;
}

/** The single most striking stat, doom- or reclaim-framed. */
export function cardHeadline(data: CardData): { title: string; sub: string } {
  const { span, habits, reclaimMode } = data;
  if (habits.length === 0) {
    return {
      title: `Week ${span.currentWeekNumber.toLocaleString()} of ${span.totalWeeks.toLocaleString()}.`,
      sub: `${span.remainingWeeks.toLocaleString()} weeks remaining.`,
    };
  }
  if (reclaimMode) {
    const totalReclaimed = habits.reduce(
      (s, h) => s + reclaimedWeeks(h.hoursPerDay, h.reclaimHours, span),
      0,
    );
    const years = totalReclaimed / 52.1775;
    return {
      title: `I'm taking back ${Math.round(totalReclaimed).toLocaleString()} weeks of my life.`,
      sub: `That's ${years.toFixed(1)} years, reclaimed from my habits.`,
    };
  }
  const top = [...habits].sort(
    (a, b) => b.hoursPerDay - a.hoursPerDay,
  )[0];
  const cost = habitCost(top.hoursPerDay, span);
  const ladder = formatLadder(cost);
  return {
    title: `${top.label} is taking ${ladder.years} years of the rest of my life.`,
    sub: `${ladder.weeks} weeks · ${ladder.months} months · ${ladder.percent}% of my remaining waking time`,
  };
}

export async function renderShareCard(
  data: CardData,
  format: CardFormat,
): Promise<HTMLCanvasElement> {
  // Ensure display fonts are ready before drawing text.
  try {
    await Promise.all([
      document.fonts.load('700 60px "Sora"'),
      document.fonts.load('500 30px "Inter"'),
      document.fonts.ready,
    ]);
  } catch {
    /* font loading failure → system fallback fonts still render fine */
  }

  const { w, h } = FORMATS[format];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");

  // Force dark-theme variables for the card by sampling from a detached
  // element is unreliable; instead use the known dark token values.
  const bg = "hsl(222 47% 7%)";
  const fg = "hsl(210 40% 96%)";
  const muted = "hsl(217 15% 62%)";
  const primary = "hsl(245 80% 68%)";
  const livedColor = "hsl(222 30% 26%)";
  const remainingColor = "hsl(222 30% 13%)";

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const pad = format === "story" ? 88 : 56;
  const headline = cardHeadline(data);
  const segments = habitSegments(data.span, data.habits, data.reclaimMode);

  if (format === "story") {
    // Wordmark
    ctx.fillStyle = primary;
    ctx.font = '800 44px "Sora", system-ui, sans-serif';
    ctx.fillText("WEEKS", pad, pad + 44);

    // Headline
    ctx.fillStyle = fg;
    ctx.font = '700 72px "Sora", system-ui, sans-serif';
    const titleLines = wrapText(ctx, headline.title, w - pad * 2);
    let y = pad + 180;
    for (const line of titleLines) {
      ctx.fillText(line, pad, y);
      y += 88;
    }

    // Sub-line
    ctx.fillStyle = muted;
    ctx.font = '500 36px "Inter", system-ui, sans-serif';
    for (const line of wrapText(ctx, headline.sub, w - pad * 2)) {
      ctx.fillText(line, pad, y + 8);
      y += 50;
    }

    // Grid
    const gridTop = y + 70;
    const gridBottom = h - 210;
    drawLifeGrid(
      ctx,
      data.span,
      segments,
      { lived: livedColor, remaining: remainingColor, currentWeek: primary },
      { x: pad, y: gridTop, width: w - pad * 2, height: gridBottom - gridTop },
    );

    // Footer: methodology + implicit CTA
    ctx.fillStyle = muted;
    ctx.font = '500 28px "Inter", system-ui, sans-serif';
    ctx.fillText(
      `1 box = 1 week · assumes ${data.sleepHours}h sleep, life expectancy ${data.lifeExpectancy}`,
      pad,
      h - 120,
    );
    ctx.fillStyle = fg;
    ctx.font = '600 30px "Inter", system-ui, sans-serif';
    ctx.fillText("How many weeks are your habits taking?", pad, h - 72);
  } else {
    // OG layout: text left, grid right.
    const textW = w * 0.52;
    ctx.fillStyle = primary;
    ctx.font = '800 30px "Sora", system-ui, sans-serif';
    ctx.fillText("WEEKS", pad, pad + 26);

    ctx.fillStyle = fg;
    ctx.font = '700 44px "Sora", system-ui, sans-serif';
    let y = pad + 110;
    for (const line of wrapText(ctx, headline.title, textW - pad)) {
      ctx.fillText(line, pad, y);
      y += 56;
    }
    ctx.fillStyle = muted;
    ctx.font = '500 24px "Inter", system-ui, sans-serif';
    for (const line of wrapText(ctx, headline.sub, textW - pad)) {
      ctx.fillText(line, pad, y + 4);
      y += 34;
    }

    drawLifeGrid(
      ctx,
      data.span,
      segments,
      { lived: livedColor, remaining: remainingColor, currentWeek: primary },
      {
        x: textW + 20,
        y: pad,
        width: w - textW - pad - 20,
        height: h - pad * 2,
      },
    );
  }

  return canvas;
}

export interface CountdownCardData {
  span: LifeSpan;
  label: string;
  countdown: Countdown;
  sleepHours: number;
  lifeExpectancy: number;
}

/** Story-format card for a countdown: highlight band instead of habit bands. */
export async function renderCountdownCard(
  data: CountdownCardData,
): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([
      document.fonts.load('700 60px "Sora"'),
      document.fonts.load('500 30px "Inter"'),
      document.fonts.ready,
    ]);
  } catch {
    /* system fallback fonts still render fine */
  }

  const { w, h } = FORMATS.story;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");

  const bg = "hsl(222 47% 7%)";
  const fg = "hsl(210 40% 96%)";
  const muted = "hsl(217 15% 62%)";
  const primary = "hsl(245 80% 68%)";

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const pad = 88;

  ctx.fillStyle = primary;
  ctx.font = '800 44px "Sora", system-ui, sans-serif';
  ctx.fillText("WEEKS", pad, pad + 44);

  ctx.fillStyle = fg;
  ctx.font = '700 72px "Sora", system-ui, sans-serif';
  const title = `${data.countdown.boxesUntil.toLocaleString()} boxes until ${data.label}.`;
  let y = pad + 180;
  for (const line of wrapText(ctx, title, w - pad * 2)) {
    ctx.fillText(line, pad, y);
    y += 88;
  }

  ctx.fillStyle = muted;
  ctx.font = '500 36px "Inter", system-ui, sans-serif';
  const sub = `${data.countdown.daysUntil.toLocaleString()} days. ${data.countdown.percentOfRemainingWeeks.toFixed(1)}% of the weeks I have left.`;
  for (const line of wrapText(ctx, sub, w - pad * 2)) {
    ctx.fillText(line, pad, y + 8);
    y += 50;
  }

  const gridTop = y + 70;
  const gridBottom = h - 210;
  drawLifeGrid(
    ctx,
    data.span,
    [
      {
        startWeek: data.countdown.startWeek,
        count: data.countdown.boxesUntil,
        color: primary,
      },
    ],
    { lived: "hsl(222 30% 26%)", remaining: "hsl(222 30% 13%)", currentWeek: primary },
    { x: pad, y: gridTop, width: w - pad * 2, height: gridBottom - gridTop },
  );

  ctx.fillStyle = muted;
  ctx.font = '500 28px "Inter", system-ui, sans-serif';
  ctx.fillText(
    `1 box = 1 week of my life · life expectancy ${data.lifeExpectancy}`,
    pad,
    h - 120,
  );
  ctx.fillStyle = fg;
  ctx.font = '600 30px "Inter", system-ui, sans-serif';
  ctx.fillText("What are you counting down to?", pad, h - 72);

  return canvas;
}

export async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("blob-failed"))),
      "image/png",
    );
  });
}

/** Share via the native sheet when possible; report which path was taken. */
export async function shareOrDownload(
  canvas: HTMLCanvasElement,
  filename: string,
): Promise<"shared" | "downloaded" | "cancelled"> {
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], filename, { type: "image/png" });

  if (
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (e) {
      if ((e as DOMException | undefined)?.name === "AbortError")
        return "cancelled";
      /* fall through to download on any other share failure */
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Re-export for the UI legend.
export { cssVarHsl };
