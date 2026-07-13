# Weeks — your life in boxes

Your life is ~4,000 weeks. This app shows where the rest of them are going:
pick your habits (or upload your iOS/Android Screen Time screenshot), and see
them converted into **weeks · months · years of your remaining waking life**,
painted onto a life grid — one box per week.

Sibling app to [bigpicture](https://github.com/avnath13/bigpicture); shares
its design system (tokens, Sora/Inter, motion, event palette).

## Features

- **Life grid** — canvas-rendered (4,000+ cells), animated fill, one box per
  week, habit costs painted from the end of life backwards.
- **Waking-time math** — all conversions are denominated in waking hours
  (24h − your sleep, default 8h). Unit ladder: weeks · months · years · % of
  remaining waking life, plus rotating lived-experience equivalences.
- **Screen Time OCR** — drop a Screen Time / Digital Wellbeing screenshot;
  parsed 100% on-device with Tesseract.js (never uploaded). Handles weekly vs
  daily views, garbled OCR names, dark-mode screenshots; always falls back to
  manual entry.
- **Reclaim mode** — drag a habit down, watch the weeks come back (emerald
  band on the grid).
- **Share cards** — deterministic canvas rendering: 1080×1920 story +
  1200×630 OG, native share sheet with download fallback.
- Light/dark themes, mobile-first responsive, localStorage persistence,
  `prefers-reduced-motion` respected, no backend, no accounts.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest (time math + OCR parser)
npm run build    # typecheck + production bundle
```

## Edge cases handled

Future/invalid/120+ birth dates; outliving your set life expectancy ("bonus
time"); habit hours capped at the waking day; corrupt localStorage; OCR
failures (bad file, unreadable, no apps found, engine load, 30s timeout) all
soft-fall-back to manual entry; leap years via ms math; theme-reactive canvas.
