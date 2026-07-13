import { Moon, Sun } from "lucide-react";
import type { Theme } from "@/hooks/useTheme";

export function Header({
  theme,
  onToggleTheme,
}: {
  theme: Theme;
  onToggleTheme: () => void;
}) {
  return (
    <header className="glass sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl font-extrabold tracking-tight">
            weeks<span className="text-primary">.</span>
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:inline">
            memento mori
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          data-testid="theme-toggle"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
      </div>
    </header>
  );
}
