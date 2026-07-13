import { parseScreenTimeText, type ParseResult } from "./screentimeParse";

/**
 * Tesseract.js wrapper. The image is processed entirely on-device — it is
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
 * Downscale + grayscale + contrast-boost the image before OCR. Screen Time
 * screenshots are high-contrast UI text; thresholding materially improves
 * Tesseract accuracy, especially for dark mode.
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

    const targetWidth = Math.min(1400, img.naturalWidth || 1400);
    const scale = targetWidth / (img.naturalWidth || targetWidth);
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = Math.round((img.naturalHeight || 1) * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new OcrError("unreadable");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    // Grayscale, then invert if the image is predominantly dark (dark mode).
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) {
      const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      px[i] = px[i + 1] = px[i + 2] = gray;
      sum += gray;
    }
    const mean = sum / (px.length / 4);
    if (mean < 110) {
      for (let i = 0; i < px.length; i += 4) {
        px[i] = px[i + 1] = px[i + 2] = 255 - px[i];
      }
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
    const result = await Promise.race([
      TesseractModule.recognize(canvas, "eng"),
      timeout,
    ]);
    text = result.data.text ?? "";
  } catch (e) {
    throw e instanceof OcrError ? e : new OcrError("unreadable");
  }

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
