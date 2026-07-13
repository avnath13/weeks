/**
 * Generate README screenshots against the local dev server.
 * Usage: node scripts/screenshots.mjs  (dev server must be running on :5173)
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://localhost:5173";
const OUT = new URL("../docs/screenshots/", import.meta.url).pathname;

const DEMO_STATE = {
  birthDateInput: "1993-06-15",
  lifeExpectancy: 80,
  sleepHours: 8,
  hiddenChips: [],
  habits: [
    { id: "scrolling", label: "Scrolling", emoji: "📱", colorVar: "--event-coral", hoursPerDay: 4.5, reclaimHours: 4.5 },
    { id: "instagram", label: "Instagram", emoji: "📸", colorVar: "--event-rose", hoursPerDay: 2.5, reclaimHours: 2.5 },
    { id: "meetings", label: "Meetings", emoji: "💼", colorVar: "--event-sky", hoursPerDay: 2.1, reclaimHours: 2.1 },
  ],
};

const COUNTDOWN = { label: "the wedding", dateInput: "2027-09-18" };

async function shoot(page, { theme, hash, file, fullPage = false, settle = 2200 }) {
  await page.goto(`${BASE}/#life`, { waitUntil: "networkidle0" });
  await page.evaluate(
    (state, countdown, t) => {
      localStorage.setItem("weeks.state.v1", JSON.stringify(state));
      localStorage.setItem("weeks.countdown.v1", JSON.stringify(countdown));
      localStorage.setItem("weeks.theme", t);
    },
    DEMO_STATE,
    COUNTDOWN,
    theme,
  );
  // Hash-only navigation doesn't remount the app; reload so it re-reads
  // the seeded localStorage.
  await page.goto(`${BASE}/${hash}`, { waitUntil: "networkidle0" });
  await page.reload({ waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, settle)); // grid fill animation
  await page.screenshot({ path: `${OUT}${file}`, fullPage });
  console.log(`wrote ${file}`);
}

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "shell" });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

await shoot(page, { theme: "dark", hash: "#life", file: "overview-dark.png", fullPage: true });
await shoot(page, { theme: "light", hash: "#life", file: "overview-light.png", fullPage: true });
await shoot(page, { theme: "dark", hash: "#habits", file: "habits-dark.png" });
await shoot(page, { theme: "dark", hash: "#countdown", file: "countdown-dark.png" });

await browser.close();
