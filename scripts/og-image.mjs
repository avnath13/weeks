/**
 * Generate the static share/link-preview assets:
 *   public/og.png               1200x630 Open Graph card
 *   public/apple-touch-icon.png 180x180
 *   public/icon-192.png         192x192 (manifest)
 *   public/icon-512.png         512x512 (manifest)
 *
 * Usage: node scripts/og-image.mjs   (no dev server needed)
 * Mirrors the share-card aesthetic in src/lib/shareCard.ts: dark theme,
 * lowercase wordmark, mono kicker, accent rule, life grid.
 */
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = new URL("../public/", import.meta.url).pathname;

const OG_HTML = `<!doctype html><html><head>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600&family=Sora:wght@700;800&display=swap" rel="stylesheet" />
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: hsl(222 47% 7%); overflow: hidden; }
</style></head><body>
<canvas id="c" width="1200" height="630"></canvas>
<script>
const DARK = {
  bg: "hsl(222 47% 7%)", fg: "hsl(210 40% 96%)", muted: "hsl(217 15% 62%)",
  primary: "hsl(245 80% 68%)", lived: "hsl(222 30% 26%)", remaining: "hsl(222 30% 13%)",
};
const BANDS = ["hsl(12 83% 62%)", "hsl(340 75% 64%)", "hsl(205 85% 62%)"];

async function draw() {
  await Promise.all([
    document.fonts.load('800 46px "Sora"'),
    document.fonts.load('700 58px "Sora"'),
    document.fonts.load('500 24px "Inter"'),
    document.fonts.ready,
  ]);
  const ctx = document.getElementById("c").getContext("2d");
  const W = 1200, H = 630, pad = 64;
  ctx.fillStyle = DARK.bg;
  ctx.fillRect(0, 0, W, H);

  // Wordmark
  ctx.font = '800 40px "Sora"';
  ctx.fillStyle = DARK.fg;
  ctx.fillText("weeks", pad, pad + 34);
  ctx.fillStyle = DARK.primary;
  ctx.fillText(".", pad + ctx.measureText("weeks").width, pad + 34);

  // Accent rule + kicker + headline + sub
  const textX = pad, indent = textX + 30;
  ctx.fillStyle = DARK.primary;
  ctx.fillRect(textX, 208, 7, 260);
  ctx.fillStyle = DARK.muted;
  ctx.font = '600 21px ui-monospace, "SF Mono", Menlo, monospace';
  try { ctx.letterSpacing = "4px"; } catch {}
  ctx.fillText("ONE BOX, ONE WEEK", indent, 236);
  try { ctx.letterSpacing = "0px"; } catch {}
  ctx.fillStyle = DARK.fg;
  ctx.font = '700 62px "Sora"';
  ctx.fillText("Your life is", indent, 316);
  ctx.fillText("~4,000 weeks.", indent, 390);
  ctx.fillStyle = DARK.muted;
  ctx.font = '500 26px "Inter"';
  ctx.fillText("See what your habits cost in the", indent, 442);
  ctx.fillText("weeks you have left.", indent, 478);

  // Life grid, right side: 52 cols x 80 rows like the app (1 row = 1 year)
  const gx = 620, gy = pad, gw = W - gx - pad, gh = H - pad * 2;
  const cols = 52, rows = 80;
  const cell = Math.min(gw / cols, gh / rows);
  const size = Math.max(1, cell * 0.78);
  const lived = Math.round(rows * cols * 0.4); // a 32-year-old at 80
  const habitWeeks = Math.round(rows * cols * 0.145);
  for (let i = 0; i < rows * cols; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    let color = i < lived ? DARK.lived : DARK.remaining;
    if (i === lived) color = DARK.primary;
    const fromEnd = rows * cols - 1 - i;
    if (fromEnd < habitWeeks) {
      color = BANDS[fromEnd < habitWeeks * 0.45 ? 0 : fromEnd < habitWeeks * 0.8 ? 1 : 2];
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(gx + c * cell, gy + r * cell, size, size, size * 0.25);
    ctx.fill();
  }
  document.title = "done";
}
draw();
</script></body></html>`;

const iconHtml = (px) => `<!doctype html><html><head><style>
  * { margin: 0; } body { width: ${px}px; height: ${px}px; overflow: hidden; }
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${px}" height="${px}">
  <rect width="32" height="32" fill="hsl(245,75%,60%)" />
  <rect x="6" y="9" width="20" height="16" rx="3" fill="white" />
  <rect x="6" y="9" width="20" height="5" rx="3" fill="hsl(245,75%,72%)" />
  <rect x="9" y="6" width="2.5" height="5" rx="1.25" fill="hsl(245,75%,40%)" />
  <rect x="20.5" y="6" width="2.5" height="5" rx="1.25" fill="hsl(245,75%,40%)" />
  <rect x="9" y="17" width="6" height="2" rx="1" fill="hsl(12,83%,62%)" />
  <rect x="9" y="21" width="10" height="2" rx="1" fill="hsl(174,62%,47%)" />
</svg></body></html>`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "shell" });
const page = await browser.newPage();

await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.setContent(OG_HTML, { waitUntil: "networkidle0" });
await page.waitForFunction('document.title === "done"', { timeout: 15000 });
await page.screenshot({ path: `${OUT}og.png` });
console.log("wrote og.png");

for (const [file, px] of [
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
]) {
  await page.setViewport({ width: px, height: px, deviceScaleFactor: 1 });
  await page.setContent(iconHtml(px), { waitUntil: "load" });
  await page.screenshot({ path: `${OUT}${file}` });
  console.log(`wrote ${file}`);
}

await browser.close();
