import { useRef, useState } from "react";
import { Download, RotateCcw, Trash2, Upload } from "lucide-react";
import { HABIT_PRESETS } from "@/lib/habits";
import { exportAllData, importAllData } from "@/lib/storage";

interface SettingsPanelProps {
  hiddenChips: string[];
  onRestoreChips: () => void;
  onResetAll: () => void;
}

export function SettingsPanel({
  hiddenChips,
  onRestoreChips,
  onResetAll,
}: SettingsPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const [importError, setImportError] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const hiddenPresets = HABIT_PRESETS.filter((p) =>
    hiddenChips.includes(p.id),
  );

  const doExport = () => {
    const blob = new Blob([exportAllData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weeks-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const doImport = async (file: File | undefined | null) => {
    if (!file) return;
    setImportError(false);
    const ok = importAllData(await file.text());
    if (!ok) {
      setImportError(true);
      return;
    }
    // Restored state only applies on a fresh mount.
    window.location.reload();
  };

  return (
    <section className="animate-fade-in-up max-w-xl" data-testid="settings-panel">
      <h2 className="font-display text-3xl font-extrabold tracking-tight">
        Settings
      </h2>

      <div className="mt-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Habit chips
        </p>
        {hiddenPresets.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            All default chips are visible. Delete one with the × on its chip
            in the Habits tab and it will show up here.
          </p>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-muted-foreground">
              Deleted: {hiddenPresets.map((p) => `${p.emoji} ${p.label}`).join(", ")}
            </p>
            <button
              type="button"
              data-testid="restore-chips"
              onClick={onRestoreChips}
              className="mt-3 flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              <RotateCcw className="h-4 w-4" /> Restore deleted chips
            </button>
          </div>
        )}
      </div>

      <div className="mt-10 border-t border-border pt-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Your data
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Everything lives in this browser: your birth date, habits, lifetime
          tweaks, countdown, and theme. Nothing is ever uploaded. Download a
          backup to move it to another device or browser.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="export-data"
            onClick={doExport}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Download backup
          </button>
          <button
            type="button"
            data-testid="import-data"
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Upload className="h-4 w-4" /> Restore backup
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="import-file-input"
            onChange={(e) => {
              void doImport(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        {importError && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            That file doesn't look like a weeks backup.
          </p>
        )}

        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          Reset wipes everything on this device and starts you clean.
        </p>
        {!confirming ? (
          <button
            type="button"
            data-testid="reset-all"
            onClick={() => setConfirming(true)}
            className="mt-4 flex items-center gap-2 rounded-md border border-destructive/40 px-4 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white"
          >
            <Trash2 className="h-4 w-4" /> Reset everything
          </button>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="reset-confirm">
            <span className="text-sm font-medium">
              Wipe all data on this device?
            </span>
            <button
              type="button"
              data-testid="reset-confirm-yes"
              onClick={onResetAll}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-destructive/90"
            >
              Yes, start clean
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              Keep my data
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
