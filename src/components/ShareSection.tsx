import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Link2, Loader2, Share2 } from "lucide-react";
import type { LifeSpan } from "@/lib/timeMath";
import type { SelectedHabit } from "@/lib/habits";
import {
  renderShareCard,
  shareOrDownload,
  canvasToBlob,
  type CardFormat,
} from "@/lib/shareCard";
import { buildShareLink } from "@/lib/shareLink";
import { cn } from "@/lib/utils";

interface ShareSectionProps {
  span: LifeSpan;
  habits: SelectedHabit[];
  reclaimMode: boolean;
  sleepHours: number;
  lifeExpectancy: number;
  birthDateInput: string;
}

export function ShareSection({
  span,
  habits,
  reclaimMode,
  sleepHours,
  lifeExpectancy,
  birthDateInput,
}: ShareSectionProps) {
  const [format, setFormat] = useState<CardFormat>("story");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const cardCanvas = useRef<HTMLCanvasElement | null>(null);

  // Re-render the preview whenever inputs change (debounced a frame).
  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        const canvas = await renderShareCard(
          { span, habits, reclaimMode, sleepHours, lifeExpectancy },
          format,
        );
        if (cancelled) return;
        cardCanvas.current = canvas;
        const holder = previewRef.current;
        if (holder) {
          holder.innerHTML = "";
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.style.borderRadius = "0.75rem";
          canvas.setAttribute("data-testid", "share-card-canvas");
          holder.appendChild(canvas);
        }
      } catch {
        /* preview failure is non-fatal; the button re-renders on demand */
      }
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [span, habits, reclaimMode, sleepHours, lifeExpectancy, format]);

  const doShare = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const canvas =
        cardCanvas.current ??
        (await renderShareCard(
          { span, habits, reclaimMode, sleepHours, lifeExpectancy },
          format,
        ));
      const outcome = await shareOrDownload(canvas, `weeks-${format}.png`);
      if (outcome === "downloaded") setFeedback("Saved to your downloads.");
      else if (outcome === "shared") setFeedback("Shared.");
    } catch {
      setFeedback("Couldn't generate the image on this browser. Try the copy button.");
    } finally {
      setBusy(false);
    }
  };

  const doCopyLink = async () => {
    setFeedback(null);
    try {
      const link = buildShareLink({
        birthDateInput,
        lifeExpectancy,
        sleepHours,
        habits,
      });
      await navigator.clipboard.writeText(link);
      setFeedback("Link copied. Whoever opens it sees this exact grid.");
    } catch {
      setFeedback("Clipboard not available here.");
    }
  };

  const doCopy = async () => {
    setFeedback(null);
    try {
      const canvas =
        cardCanvas.current ??
        (await renderShareCard(
          { span, habits, reclaimMode, sleepHours, lifeExpectancy },
          format,
        ));
      const blob = await canvasToBlob(canvas);
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setFeedback("Copied to clipboard.");
    } catch {
      setFeedback("Clipboard not available here. Use Share instead.");
    }
  };

  if (habits.length === 0 && !span) return null;

  return (
    <section className="animate-fade-in-up" data-testid="share-section">
      <h2 className="font-display text-3xl font-extrabold tracking-tight">
        Make it real. Show someone.
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Your grid and one stat, sized for a story or a link preview.
      </p>

      <div className="mt-4 flex items-center gap-2">
        {(
          [
            ["story", "Story (9:16)"],
            ["og", "Wide (OG)"],
          ] as [CardFormat, string][]
        ).map(([f, label]) => (
          <button
            key={f}
            type="button"
            data-testid={`format-${f}`}
            onClick={() => setFormat(f)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider transition-colors",
              format === f
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        ref={previewRef}
        className={cn(
          "mt-4 overflow-hidden rounded-xl border border-border shadow-lg",
          format === "story" ? "mx-auto max-w-[280px]" : "max-w-md",
        )}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="share-button"
          onClick={() => void doShare()}
          disabled={busy}
          className="flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
          Get my card
        </button>
        <button
          type="button"
          onClick={() => void doCopy()}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          <Copy className="h-4 w-4" /> Copy
        </button>
        <button
          type="button"
          onClick={() => void doShare()}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent sm:hidden"
        >
          <Download className="h-4 w-4" /> Save
        </button>
        <button
          type="button"
          data-testid="copy-link-button"
          onClick={() => void doCopyLink()}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          <Link2 className="h-4 w-4" /> Copy link
        </button>
      </div>
      {feedback && (
        <p
          className="mt-2 flex items-center gap-1.5 text-sm text-event-emerald"
          data-testid="share-feedback"
          role="status"
        >
          <Check className="h-4 w-4" /> {feedback}
        </p>
      )}
    </section>
  );
}
