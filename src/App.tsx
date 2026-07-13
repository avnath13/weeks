import { useTheme } from "@/hooks/useTheme";
import { useAppState } from "@/hooks/useAppState";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { WeeksTicker, LifeProgressBar } from "@/components/WeeksTicker";
import { LifeGrid } from "@/components/LifeGrid";
import { HabitPicker } from "@/components/HabitPicker";
import { ScreenshotImport } from "@/components/ScreenshotImport";
import { RevealStats } from "@/components/RevealStats";
import { ReclaimPanel } from "@/components/ReclaimPanel";
import { ShareSection } from "@/components/ShareSection";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const state = useAppState();
  const { span } = state;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header theme={theme} onToggleTheme={toggleTheme} />

      <main className="mx-auto max-w-4xl space-y-12 px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
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
          <>
            <section className="animate-fade-in-up space-y-5" data-testid="grid-section">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="font-display text-xl font-bold" data-testid="week-counter">
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
            </section>

            <div>
              <HabitPicker
                habits={state.habits}
                setHabits={state.setHabits}
                span={span}
              />
              <ScreenshotImport span={span} setHabits={state.setHabits} />
            </div>

            <RevealStats span={span} habits={state.habits} />

            <ReclaimPanel
              span={span}
              habits={state.habits}
              setHabits={state.setHabits}
              reclaimMode={state.reclaimMode}
              setReclaimMode={state.setReclaimMode}
            />

            {state.habits.length > 0 && (
              <ShareSection
                span={span}
                habits={state.habits}
                reclaimMode={state.reclaimMode}
                sleepHours={state.sleepHours}
                lifeExpectancy={state.lifeExpectancy}
              />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-border py-6">
        <p className="mx-auto max-w-4xl px-4 text-xs leading-relaxed text-muted-foreground sm:px-6">
          Methodology: 1 box = 1 week. Habit costs are measured against your
          remaining <em>waking</em> time (24h − your sleep), assuming your set
          life expectancy. Defaults are population averages — edit everything.
          Nothing you enter leaves your browser.
        </p>
      </footer>
    </div>
  );
}
