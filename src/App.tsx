import { useEffect, useMemo, useState } from "react";
import { Grid3X3, History, Hourglass, Share2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAppState } from "@/hooks/useAppState";
import { formatLadder, habitCost } from "@/lib/timeMath";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { WeeksTicker, LifeProgressBar } from "@/components/WeeksTicker";
import { LifeGrid } from "@/components/LifeGrid";
import { HabitPicker } from "@/components/HabitPicker";
import { ScreenshotImport } from "@/components/ScreenshotImport";
import { RevealStats } from "@/components/RevealStats";
import { ReclaimPanel } from "@/components/ReclaimPanel";
import { ShareSection } from "@/components/ShareSection";
import { LifetimeStats } from "@/components/LifetimeStats";
import { cn } from "@/lib/utils";

type Tab = "life" | "habits" | "lifetime" | "share";

const TABS: { id: Tab; label: string; icon: typeof Grid3X3 }[] = [
  { id: "life", label: "Your life", icon: Grid3X3 },
  { id: "habits", label: "Habits", icon: Hourglass },
  { id: "lifetime", label: "Lifetime", icon: History },
  { id: "share", label: "Share", icon: Share2 },
];

function tabFromHash(): Tab {
  const h = window.location.hash.replace("#", "");
  return (TABS.some((t) => t.id === h) ? h : "life") as Tab;
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const state = useAppState();
  const { span } = state;
  const [tab, setTab] = useState<Tab>(tabFromHash);

  // Hash <-> tab sync (back button works, tabs are linkable).
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const goTo = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", `#${t}`);
  };

  // Tools need a valid birth date; bounce back to Life until there is one.
  useEffect(() => {
    if (!span && tab !== "life") goTo("life");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [span, tab]);

  const combinedLadder = useMemo(() => {
    if (!span || state.habits.length === 0) return null;
    const hours = state.habits.reduce((s, h) => s + h.hoursPerDay, 0);
    return formatLadder(habitCost(hours, span));
  }, [span, state.habits]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header theme={theme} onToggleTheme={toggleTheme} />

      {span && (
        <nav
          className="glass sticky top-14 z-30 border-b"
          aria-label="Tools"
          data-testid="tab-bar"
        >
          <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2 no-scrollbar sm:px-6">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                data-testid={`tab-${id}`}
                onClick={() => goTo(id)}
                aria-current={tab === id ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  tab === id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        {(!span || tab === "life") && (
          <div className="space-y-12">
            <Hero
              birthDateInput={state.birthDateInput}
              onBirthDateChange={state.setBirthDateInput}
              birthIssue={state.birthIssue}
              lifeExpectancy={state.lifeExpectancy}
              onLifeExpectancyChange={state.setLifeExpectancy}
              sleepHours={state.sleepHours}
              onSleepChange={state.setSleepHours}
            />

            {span && (
              <section
                className="animate-fade-in-up space-y-5"
                data-testid="grid-section"
              >
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p
                      className="font-display text-xl font-bold"
                      data-testid="week-counter"
                    >
                      {span.onBonusTime
                        ? "Every box from here is a bonus."
                        : `Week ${span.currentWeekNumber.toLocaleString()} of ${span.totalWeeks.toLocaleString()}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      One box = one week of your life.
                    </p>
                  </div>
                  <WeeksTicker span={span} />
                </div>
                <LifeProgressBar span={span} />
                <LifeGrid
                  span={span}
                  habits={state.habits}
                  reclaimMode={state.reclaimMode}
                  theme={theme}
                />
                <p className="text-sm text-muted-foreground">
                  Now put your habits on it: head to the{" "}
                  <button
                    type="button"
                    onClick={() => goTo("habits")}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Habits tab
                  </button>
                  .
                </p>
              </section>
            )}
          </div>
        )}

        {span && tab === "habits" && (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
            <div>
              <HabitPicker
                habits={state.habits}
                setHabits={state.setHabits}
                span={span}
              />
            </div>

            {/* The impact panel: on desktop it sits beside the controls and
                stays put while you scroll; on mobile it stacks right under
                the picker so cause and effect share a screen. */}
            <div
              className="self-start lg:sticky lg:top-32 lg:col-start-2 lg:row-span-2 lg:row-start-1"
              data-testid="impact-panel"
            >
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {span.onBonusTime
                      ? "Every box is a bonus."
                      : `${span.remainingWeeks.toLocaleString()} weeks remaining`}
                  </p>
                  {combinedLadder && (
                    <p
                      className="font-mono text-xs tabular-nums text-muted-foreground"
                      data-testid="impact-summary"
                    >
                      habits: {combinedLadder.weeks} wks ·{" "}
                      {combinedLadder.years} yrs
                    </p>
                  )}
                </div>
                <div className="mt-3">
                  <LifeGrid
                    span={span}
                    habits={state.habits}
                    reclaimMode={state.reclaimMode}
                    theme={theme}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-8 lg:col-start-1">
              <RevealStats span={span} habits={state.habits} />
              <ReclaimPanel
                span={span}
                habits={state.habits}
                setHabits={state.setHabits}
                reclaimMode={state.reclaimMode}
                setReclaimMode={state.setReclaimMode}
              />
              <ScreenshotImport span={span} setHabits={state.setHabits} />
            </div>
          </div>
        )}

        {span && tab === "lifetime" && (
          <LifetimeStats
            span={span}
            sleepHours={state.sleepHours}
            lifeExpectancy={state.lifeExpectancy}
          />
        )}

        {span && tab === "share" && (
          <div className="space-y-6">
            {state.habits.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="font-display text-xl font-bold">
                  Nothing to show yet.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick a habit or two first, then come back for your card.
                </p>
                <button
                  type="button"
                  onClick={() => goTo("habits")}
                  className="mt-4 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  Go to Habits
                </button>
              </div>
            ) : (
              <ShareSection
                span={span}
                habits={state.habits}
                reclaimMode={state.reclaimMode}
                sleepHours={state.sleepHours}
                lifeExpectancy={state.lifeExpectancy}
              />
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-border py-6">
        <p className="mx-auto max-w-5xl px-4 text-xs leading-relaxed text-muted-foreground sm:px-6">
          Methodology: 1 box = 1 week, leap years counted exactly. Habit costs
          are measured against your remaining waking time (24h minus your
          sleep), assuming your set life expectancy. Defaults are population
          averages; edit everything. Nothing you enter leaves your browser.
        </p>
      </footer>
    </div>
  );
}
