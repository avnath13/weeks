import { parseScreenTimeText, type ParseResult } from "./screentimeParse";

/**
 * Tesseract.js wrapper. The image is processed entirely on-device - it is
 * never uploaded anywhere. Lazy-loads the engine on first use.
 */

export type OcrFailure =
  | "engine-load-failed"
  | "unreadable"
  | "no-apps-found"
  | "timeout"
  | "bad-file";

export class OcrError extends Error {
  constructor(public reason: OcrFailure) {
    super(reason);
  }
}

const OCR_TIMEOUT_MS = 30_000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_TYPES = /^image\/(png|jpe?g|webp|heic|heif)$/i;

export function validateImageFile(file: File): OcrFailure | null {
  if (!ACCEPTED_TYPES.test(file.type) && !/\.(png|jpe?g|webp|heic)$/i.test(file.name))
    return "bad-file";
  if (file.size === 0 || file.size > MAX_FILE_BYTES) return "bad-file";
  return null;
}

/**
 * Normalize the image for OCR: upscale small screenshots (Tesseract wants
 * tall glyphs), grayscale, invert dark mode, then stretch contrast so the
 * light-gray duration text ("14h 32m") separates cleanly from the background.
 */
async function preprocess(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new OcrError("bad-file"));
      el.src = url;
    });

    const natural = img.naturalWidth || 1400;
    // Upscale to ~2000px wide for phone screenshots; never downscale below
    // native, never blow up beyond 2.5x (blurry upscales hurt more than help).
    const targetWidth = Math.round(
      Math.min(Math.max(natural, 2000), natural * 2.5),
    );
    const scale = targetWidth / natural;
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = Math.round((img.naturalHeight || 1) * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new OcrError("unreadable");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;

    // Grayscale + luminance histogram.
    const hist = new Uint32Array(256);
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) {
      const gray = Math.round(
        0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2],
      );
      px[i] = px[i + 1] = px[i + 2] = gray;
      hist[gray]++;
      sum += gray;
    }
    const total = px.length / 4;
    const invert = sum / total < 110; // dark mode

    // Contrast stretch between the 2nd and 98th percentile.
    let lo = 0;
    let hi = 255;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= total * 0.02) {
        lo = v;
        break;
      }
    }
    acc = 0;
    for (let v = 255; v >= 0; v--) {
      acc += hist[v];
      if (acc >= total * 0.02) {
        hi = v;
        break;
      }
    }
    const range = Math.max(1, hi - lo);
    for (let i = 0; i < px.length; i += 4) {
      let v = Math.min(255, Math.max(0, ((px[i] - lo) / range) * 255));
      if (invert) v = 255 - v;
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    ctx.putImageData(data, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function recognizeScreenTime(file: File): Promise<ParseResult> {
  const fileIssue = validateImageFile(file);
  if (fileIssue) throw new OcrError(fileIssue);

  let canvas: HTMLCanvasElement;
  try {
    canvas = await preprocess(file);
  } catch (e) {
    throw e instanceof OcrError ? e : new OcrError("unreadable");
  }

  let TesseractModule: typeof import("tesseract.js");
  try {
    TesseractModule = await import("tesseract.js");
  } catch {
    throw new OcrError("engine-load-failed");
  }

  const timeout = new Promise<never>((_, reject) =>
    window.setTimeout(() => reject(new OcrError("timeout")), OCR_TIMEOUT_MS),
  );

  let text: string;
  try {
    const run = (async () => {
      const worker = await TesseractModule.createWorker("eng");
      try {
        // Screen Time screenshots are a single column of variable-size text;
        // PSM 4 reads list rows far more reliably than full auto layout.
        await worker.setParameters({
          tessedit_pageseg_mode: "4" as never,
          preserve_interword_spaces: "1",
        });
        const result = await worker.recognize(canvas);
        return result.data.text ?? "";
      } finally {
        void worker.terminate();
      }
    })();
    text = await Promise.race([run, timeout]);
  } catch (e) {
    throw e instanceof OcrError ? e : new OcrError("unreadable");
  }

  // Keep the raw OCR text inspectable: real-device failures are impossible
  // to diagnose without it, and it never leaves the browser.
  console.debug("[weeks] screen time OCR text:\n", text);

  const parsed = parseScreenTimeText(text);
  if (parsed.apps.length === 0) throw new OcrError("no-apps-found");
  return parsed;
}

export const OCR_ERROR_COPY: Record<OcrFailure, string> = {
  "bad-file": "That doesn't look like an image we can read. Try a PNG or JPG screenshot.",
  "engine-load-failed": "Couldn't load the on-device reader (are you offline?). Enter your numbers manually below.",
  unreadable: "We couldn't read that screenshot. Try a clearer one, or enter your numbers manually.",
  "no-apps-found": "We couldn't find app times in that image. Make sure it's the Screen Time app list, or enter numbers manually.",
  timeout: "Reading took too long on this device. Enter your numbers manually below.",
};
