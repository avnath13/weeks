import { useEffect, useMemo, useRef } from "react";
import type { LifeSpan } from "@/lib/timeMath";
import type { SelectedHabit } from "@/lib/habits";
import {
  drawLifeGrid,
  habitSegments,
  gridPixelHeight,
  cssVarHsl,
} from "@/lib/gridDraw";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { Theme } from "@/hooks/useTheme";

interface LifeGridProps {
  span: LifeSpan;
  habits: SelectedHabit[];
  reclaimMode: boolean;
  theme: Theme;
}

/**
 * The on-screen life grid. Canvas-rendered (4,000+ cells is too heavy for
 * DOM nodes on mobile), animated fill on data changes, DPR-aware, and
 * re-drawn on resize and theme change.
 */
export function LifeGrid({ span, habits, reclaimMode, theme }: LifeGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const lastSignature = useRef<string>("");
  const reducedMotion = useReducedMotion();

  // Signature of everything that affects pixels - animate only on change.
  const signature = useMemo(
    () =>
      JSON.stringify({
        t: span.totalWeeks,
        l: span.livedWeeks,
        h: habits.map((h) => [h.id, h.hoursPerDay, h.reclaimHours]),
        r: reclaimMode,
        theme,
      }),
    [span, habits, reclaimMode, theme],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const render = (progress: number) => {
      const width = container.clientWidth;
      if (width === 0) return;
      const height = gridPixelHeight(span, width);
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      drawLifeGrid(
        ctx,
        span,
        habitSegments(span, habits, reclaimMode),
        {
          lived: cssVarHsl("--foreground", 0.75),
          remaining: cssVarHsl("--foreground", 0.1),
          currentWeek: cssVarHsl("--primary"),
        },
        { x: 0, y: 0, width, height, progress, showCurrentWeekPulse: true },
      );
    };

    const animate = () => {
      cancelAnimationFrame(animRef.current);
      if (reducedMotion) {
        render(1);
        return;
      }
      const start = performance.now();
      const duration = 1400;
      const tick = (t: number) => {
        const raw = Math.min(1, (t - start) / duration);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - raw, 3);
        render(eased);
        if (raw < 1) animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
    };

    if (signature !== lastSignature.current) {
      lastSignature.current = signature;
      animate();
    } else {
      render(1);
    }

    const ro = new ResizeObserver(() => render(1));
    ro.observe(container);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(animRef.current);
    };
  }, [signature, span, habits, reclaimMode, reducedMotion]);

  return (
    <div ref={containerRef} className="w-full" data-testid="life-grid">
      <canvas ref={canvasRef} aria-label="Your life in weeks, one box per week" role="img" />
    </div>
  );
}
