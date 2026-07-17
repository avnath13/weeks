import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllData,
  exportAllData,
  importAllData,
  loadCountdownRaw,
  loadLifetimeHours,
  loadState,
  loadTheme,
  saveCountdownRaw,
  saveLifetimeHours,
  saveState,
  saveTheme,
  type PersistedState,
} from "@/lib/storage";

/** In-memory localStorage so the pure-node test env can exercise storage. */
function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    get length() {
      return store.size;
    },
    _store: store,
  };
}

let ls: ReturnType<typeof makeLocalStorage>;

beforeEach(() => {
  ls = makeLocalStorage();
  vi.stubGlobal("window", { localStorage: ls });
});

const STATE: PersistedState = {
  birthDateInput: "1993-06-15",
  lifeExpectancy: 80,
  sleepHours: 8,
  habits: [
    {
      id: "instagram",
      label: "Instagram",
      emoji: "📸",
      colorVar: "--event-rose",
      hoursPerDay: 2.5,
      reclaimHours: 1,
    },
  ],
  hiddenChips: ["commute"],
  reclaimMode: true,
};

describe("loadState / saveState", () => {
  it("round-trips", () => {
    saveState(STATE);
    expect(loadState()).toEqual(STATE);
  });

  it("returns null when nothing stored", () => {
    expect(loadState()).toBeNull();
  });

  it("recovers from corrupt JSON and removes the bad key", () => {
    ls.setItem("weeks.state.v1", "{not json");
    expect(loadState()).toBeNull();
    expect(ls.getItem("weeks.state.v1")).toBeNull();
  });

  it("rejects a payload missing required fields", () => {
    ls.setItem("weeks.state.v1", JSON.stringify({ birthDateInput: "x" }));
    expect(loadState()).toBeNull();
  });

  it("drops malformed habits but keeps the rest", () => {
    ls.setItem(
      "weeks.state.v1",
      JSON.stringify({
        ...STATE,
        habits: [STATE.habits[0], { id: 5 }, null, "nope"],
      }),
    );
    expect(loadState()?.habits).toHaveLength(1);
  });

  it("back-fills reclaimHours from hoursPerDay", () => {
    const legacy = {
      ...STATE,
      habits: [{ ...STATE.habits[0], reclaimHours: undefined }],
    };
    ls.setItem("weeks.state.v1", JSON.stringify(legacy));
    expect(loadState()?.habits[0].reclaimHours).toBe(2.5);
  });

  it("defaults reclaimMode to false for pre-v1.1 payloads", () => {
    const legacy: Partial<PersistedState> = { ...STATE };
    delete legacy.reclaimMode;
    ls.setItem("weeks.state.v1", JSON.stringify(legacy));
    expect(loadState()?.reclaimMode).toBe(false);
  });
});

describe("theme / lifetime / countdown accessors", () => {
  it("round-trips the theme and rejects junk", () => {
    saveTheme("dark");
    expect(loadTheme()).toBe("dark");
    ls.setItem("weeks.theme", "hotdog");
    expect(loadTheme()).toBeNull();
  });

  it("round-trips lifetime hours, dropping non-numeric entries", () => {
    saveLifetimeHours({ tv: 2, phone: 4.5 });
    expect(loadLifetimeHours()).toEqual({ tv: 2, phone: 4.5 });
    ls.setItem("weeks.lifetime.v1", JSON.stringify({ tv: "lots", phone: 4.5 }));
    expect(loadLifetimeHours()).toEqual({ phone: 4.5 });
  });

  it("returns null for corrupt lifetime/countdown JSON", () => {
    ls.setItem("weeks.lifetime.v1", "{oops");
    expect(loadLifetimeHours()).toBeNull();
    ls.setItem("weeks.countdown.v1", "{oops");
    expect(loadCountdownRaw()).toBeNull();
  });
});

describe("clearAllData", () => {
  it("wipes every app key including legacy", () => {
    saveState(STATE);
    saveTheme("dark");
    saveLifetimeHours({ tv: 2 });
    saveCountdownRaw({ label: "x", dateInput: "2030-01-01" });
    ls.setItem("bigpicture.theme", "dark");
    clearAllData();
    expect(ls.length).toBe(0);
  });
});

describe("export / import", () => {
  it("round-trips a full backup", () => {
    saveState(STATE);
    saveTheme("dark");
    saveLifetimeHours({ tv: 2 });
    saveCountdownRaw({ label: "wedding", dateInput: "2027-09-18" });

    const backup = exportAllData();
    clearAllData();
    expect(loadState()).toBeNull();

    expect(importAllData(backup)).toBe(true);
    expect(loadState()).toEqual(STATE);
    expect(loadTheme()).toBe("dark");
    expect(loadLifetimeHours()).toEqual({ tv: 2 });
    expect(loadCountdownRaw()).toEqual({
      label: "wedding",
      dateInput: "2027-09-18",
    });
  });

  it("rejects files that aren't weeks backups", () => {
    expect(importAllData("not json at all")).toBe(false);
    expect(importAllData(JSON.stringify({ app: "other", data: {} }))).toBe(
      false,
    );
    expect(importAllData(JSON.stringify({ app: "weeks" }))).toBe(false);
  });

  it("ignores unknown keys in a tampered backup", () => {
    const backup = JSON.stringify({
      app: "weeks",
      version: 1,
      data: { "evil.key": "payload", "weeks.theme": "light" },
    });
    expect(importAllData(backup)).toBe(true);
    expect(ls.getItem("evil.key")).toBeNull();
    expect(loadTheme()).toBe("light");
  });

  it("rejects an invalid theme value in a tampered backup", () => {
    const backup = JSON.stringify({
      app: "weeks",
      version: 1,
      data: { "weeks.theme": "<script>" },
    });
    expect(importAllData(backup)).toBe(true);
    expect(loadTheme()).toBeNull();
  });
});
