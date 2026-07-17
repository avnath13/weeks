import type { Countdown, LifeSpan } from "./timeMath";
import { formatLadder, habitCost, reclaimedWeeks } from "./timeMath";
import type { SelectedHabit } from "./habits";
import { drawLifeGrid, habitSegments, cssVarHsl } from "./gridDraw";

/**
 * Share-card renderer. Draws directly to canvas (deterministic, no
 * DOM-to-image quirks). Cards always use the dark theme for a consistent
 * brand in feeds, and mirror the app's editorial style: lowercase wordmark,
 * mono uppercase kicker, accent left rule beside the headline.
 */

export type CardFormat = "story" | "og";

const FORMATS: Record<CardFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  og: { w: 1200, h: 630 },
};

const DARK = {
  bg: "hsl(222 47% 7%)",
  fg: "hsl(210 40% 96%)",
  muted: "hsl(217 15% 62%)",
  border: "hsl(222 25% 20%)",
  primary: "hsl(245 80% 68%)",
  lived: "hsl(222 30% 26%)",
  remaining: "hsl(222 30% 13%)",
};

const SORA = '"Sora", system-ui, sans-serif';
const INTER = '"Inter", system-ui, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

export interface CardData {
  span: LifeSpan;
  habits: SelectedHabit[];
  reclaimMode: boolean;
  sleepHours: number;
  lifeExpectancy: number;
}

export interface CardText {
  kicker: string;
  title: string;
  sub: string;
  accent: string;
}

export function habitCardText(data: CardData): CardText {
  const { span, habits, reclaimMode } = data;
  if (habits.length === 0) {
    return {
      kicker: "One box, one week",
      title: `Week ${span.currentWeekNumber.toLocaleString()} of ${span.totalWeeks.toLocaleString()}.`,
      sub: `${span.remainingWeeks.toLocaleString()} weeks remaining.`,
      accent: DARK.primary,
    };
  }
  if (reclaimMode) {
    const totalReclaimed = habits.reduce(
      (s, h) => s + reclaimedWeeks(h.hoursPerDay, h.reclaimHours, span),
      0,
    );
    return {
      kicker: "Reclaim mode",
      title: `I'm taking back ${Math.round(totalReclaimed).toLocaleString()} weeks of my life.`,
      sub: `That's ${(totalReclaimed / 52.1775).toFixed(1)} years, reclaimed from my habits.`,
      accent: cssVarHsl("--event-emerald"),
    };
  }
  const top = [...habits].sort((a, b) => b.hoursPerDay - a.hoursPerDay)[0];
  const ladder = formatLadder(habitCost(top.hoursPerDay, span));
  return {
    kicker: `Of my ${Math.round(span.remainingWakingWeeks).toLocaleString()} remaining waking weeks`,
    title: `${top.label} is taking ${ladder.years} years of the rest of my life.`,
    sub: `${ladder.weeks} weeks · ${ladder.months} months · ${ladder.percent}% of my remaining waking time`,
    accent: cssVarHsl(top.colorVar),
  };
}

async function loadFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`800 44px ${SORA}`),
      document.fonts.load(`700 72px ${SORA}`),
      document.fonts.load(`500 32px ${INTER}`),
      document.fonts.ready,
    ]);
  } catch {
    /* system fallbacks still render fine */
  }
}

function makeCanvas(format: CardFormat): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
} {
  const { w, h } = FORMATS[format];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");
  ctx.fillStyle = DARK.bg;
  ctx.fillRect(0, 0, w, h);
  return { canvas, ctx, w, h };
}

function drawWordmark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.font = `800 ${size}px ${SORA}`;
  ctx.fillStyle = DARK.fg;
  ctx.fillText("weeks", x, y);
  const width = ctx.measureText("weeks").width;
  ctx.fillStyle = DARK.primary;
  ctx.fillText(".", x + width, y);
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number): void {
  // letterSpacing landed in Chrome 99 / Safari 17; older engines just
  // render without tracking, which is acceptable.
  try {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
  } catch {
    /* unsupported: render untracked */
  }
}

interface HeadlineBlock {
  bottom: number;
}

/** Kicker + headline + sub beside a thick accent rule, app-style. */
function drawHeadlineBlock(
  ctx: CanvasRenderingContext2D,
  text: CardText,
  opts: {
    x: number;
    y: number;
    maxWidth: number;
    kickerSize: number;
    titleSize: number;
    subSize: number;
  },
): HeadlineBlock {
  const indent = opts.x + Math.round(opts.titleSize * 0.55);
  const textWidth = opts.maxWidth - (indent - opts.x);
  const top = opts.y;
  let y = top;

  // Measure first so the rule can span the whole block.
  ctx.font = `700 ${opts.titleSize}px ${SORA}`;
  const titleLines = wrapText(ctx, text.title, textWidth);
  ctx.font = `500 ${opts.subSize}px ${INTER}`;
  const subLines = wrapText(ctx, text.sub, textWidth);

  const kickerLead = Math.round(opts.kickerSize * 1.4);
  const titleLead = Math.round(opts.titleSize * 1.18);
  const subLead = Math.round(opts.subSize * 1.45);
  const blockHeight =
    kickerLead + 18 + titleLines.length * titleLead + 10 + subLines.length * subLead;

  ctx.fillStyle = text.accent;
  ctx.fillRect(opts.x, top - kickerLead + 8, Math.max(6, Math.round(opts.titleSize * 0.11)), blockHeight);

  ctx.fillStyle = DARK.muted;
  ctx.font = `600 ${opts.kickerSize}px ${MONO}`;
  setLetterSpacing(ctx, Math.round(opts.kickerSize * 0.18));
  ctx.fillText(text.kicker.toUpperCase(), indent, y);
  setLetterSpacing(ctx, 0);
  y += 18 + titleLead;

  ctx.fillStyle = DARK.fg;
  ctx.font = `700 ${opts.titleSize}px ${SORA}`;
  for (const line of titleLines) {
    ctx.fillText(line, indent, y);
    y += titleLead;
  }
  y += 10;

  ctx.fillStyle = DARK.muted;
  ctx.font = `500 ${opts.subSize}px ${INTER}`;
  for (const line of subLines) {
    ctx.fillText(line, indent, y);
    y += subLead;
  }

  return { bottom: y };
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pad: number,
  methodology: string,
  question: string,
): void {
  ctx.strokeStyle = DARK.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, h - 170);
  ctx.lineTo(w - pad, h - 170);
  ctx.stroke();

  ctx.fillStyle = DARK.muted;
  ctx.font = `500 24px ${MONO}`;
  setLetterSpacing(ctx, 2);
  ctx.fillText(methodology.toUpperCase(), pad, h - 118);
  setLetterSpacing(ctx, 0);

  ctx.fillStyle = DARK.fg;
  ctx.font = `600 30px ${INTER}`;
  ctx.fillText(question, pad, h - 66);
}

export async function renderShareCard(
  data: CardData,
  format: CardFormat,
): Promise<HTMLCanvasElement> {
  await loadFonts();
  const { canvas, ctx, w, h } = makeCanvas(format);
  const text = habitCardText(data);
  const segments = habitSegments(data.span, data.habits, data.reclaimMode);
  const gridColors = {
    lived: DARK.lived,
    remaining: DARK.remaining,
    currentWeek: DARK.primary,
  };

  if (format === "story") {
    const pad = 88;
    drawWordmark(ctx, pad, pad + 42, 42);
    const block = drawHeadlineBlock(ctx, text, {
      x: pad,
      y: pad + 190,
      maxWidth: w - pad * 2,
      kickerSize: 26,
      titleSize: 74,
      subSize: 33,
    });
    drawLifeGrid(ctx, data.span, segments, gridColors, {
      x: pad,
      y: block.bottom + 55,
      width: w - pad * 2,
      height: h - 230 - (block.bottom + 55),
    });
    drawFooter(
      ctx,
      w,
      h,
      pad,
      `1 box = 1 week · ${data.sleepHours}h sleep · life expectancy ${data.lifeExpectancy}`,
      "How many weeks are your habits taking?",
    );
  } else {
    const pad = 56;
    const textW = w * 0.52;
    drawWordmark(ctx, pad, pad + 30, 30);
    drawHeadlineBlock(ctx, text, {
      x: pad,
      y: pad + 120,
      maxWidth: textW - pad,
      kickerSize: 17,
      titleSize: 42,
      subSize: 22,
    });
    drawLifeGrid(ctx, data.span, segments, gridColors, {
      x: textW + 20,
      y: pad,
      width: w - textW - pad - 20,
      height: h - pad * 2,
    });
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

/** Story-format countdown card: highlight band instead of habit bands. */
export async function renderCountdownCard(
  data: CountdownCardData,
): Promise<HTMLCanvasElement> {
  await loadFonts();
  const { canvas, ctx, w, h } = makeCanvas("story");
  const pad = 88;

  drawWordmark(ctx, pad, pad + 42, 42);
  const block = drawHeadlineBlock(
    ctx,
    {
      kicker: "Counting down",
      title: `${data.countdown.boxesUntil.toLocaleString()} weeks until ${data.label}.`,
      sub: `${data.countdown.daysUntil.toLocaleString()} days. ${data.countdown.percentOfRemainingWeeks.toFixed(1)}% of the weeks I have left.`,
      accent: DARK.primary,
    },
    {
      x: pad,
      y: pad + 190,
      maxWidth: w - pad * 2,
      kickerSize: 26,
      titleSize: 74,
      subSize: 33,
    },
  );

  drawLifeGrid(
    ctx,
    data.span,
    [
      {
        startWeek: data.countdown.startWeek,
        count: data.countdown.boxesUntil,
        color: DARK.primary,
      },
    ],
    { lived: DARK.lived, remaining: DARK.remaining, currentWeek: DARK.primary },
    {
      x: pad,
      y: block.bottom + 55,
      width: w - pad * 2,
      height: h - 230 - (block.bottom + 55),
    },
  );

  drawFooter(
    ctx,
    w,
    h,
    pad,
    `1 box = 1 week of my life · life expectancy ${data.lifeExpectancy}`,
    "What are you counting down to?",
  );

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
