/**
 * Turns a photo into something Gemini can read.
 *
 * Phone cameras produce 4000px, 6MB images. Sending one of those costs the
 * student a slow upload and buys nothing: legibility of handwriting on a
 * whiteboard is decided long before that resolution. So the image is drawn
 * into a canvas at a sane size and re-encoded before it ever leaves the
 * browser, which also strips EXIF, including any GPS tag the camera wrote.
 */

export const MAX_IMAGES = 3;
const MAX_EDGE = 1600;
const QUALITY = 0.85;

/** What the file picker and the route both accept. */
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export interface LoadedImage {
  name: string;
  /** Base64 with no data URL prefix, which is what the API expects. */
  data: string;
  mimeType: string;
  /** Data URL, for the thumbnail. */
  preview: string;
  bytes: number;
}

export class ImageError extends Error {}

function loadBitmap(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageError("That image could not be opened. Try a PNG or JPEG."));
    };
    img.src = url;
  });
}

export function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

export async function readImage(file: File): Promise<LoadedImage> {
  if (!isImage(file)) throw new ImageError("That file is not an image.");

  const img = await loadBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("This browser could not process the image.");

  // A white ground matters: a transparent PNG of dark handwriting becomes
  // black on black otherwise, and the model sees nothing.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const preview = canvas.toDataURL("image/jpeg", QUALITY);
  const data = preview.split(",")[1] ?? "";

  if (!data) throw new ImageError("That image could not be encoded. Try a PNG or JPEG.");

  return {
    name: file.name,
    data,
    mimeType: "image/jpeg",
    preview,
    // Base64 carries about a third of overhead, so this is the real payload.
    bytes: Math.round((data.length * 3) / 4),
  };
}
