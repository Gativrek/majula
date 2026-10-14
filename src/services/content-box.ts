/**
 * Where a page's content is, found by looking at the page (`docs/modules/reading-queue.md`
 * criterion 15a). Trimming margins this way works on any PDF, including scans, where the
 * PDF itself says nothing about where the text sits.
 *
 * Pure: it takes RGBA pixels, so it is tested without PDF.js or a canvas.
 */

/** A region of the page as fractions of its width and height, from the top-left. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const WHOLE_PAGE: Box = { left: 0, top: 0, right: 1, bottom: 1 };

/** A channel this dark counts as ink. Paper, JPEG noise and faint scan grey do not. */
const INK_BELOW = 230;

/** Breathing room kept around the content, as a fraction of the page. */
const PADDING = 0.02;

/**
 * Below this much saving the page is shown whole: trimming a sliver only makes the size
 * jump between pages for nothing.
 */
const WORTHWHILE = 0.05;

function isInk(pixels: Uint8ClampedArray, offset: number): boolean {
  if ((pixels[offset + 3] ?? 0) < 16) return false;
  return (
    (pixels[offset] ?? 255) < INK_BELOW ||
    (pixels[offset + 1] ?? 255) < INK_BELOW ||
    (pixels[offset + 2] ?? 255) < INK_BELOW
  );
}

/**
 * The box around everything inked on the page, padded a little.
 *
 * @returns the whole page when it is blank, or when its margins are too thin to be worth
 * trimming (criterion 15a).
 */
export function findContentBox(pixels: Uint8ClampedArray, width: number, height: number): Box {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isInk(pixels, (y * width + x) * 4)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return WHOLE_PAGE;

  const box: Box = {
    left: Math.max(0, minX / width - PADDING),
    top: Math.max(0, minY / height - PADDING),
    right: Math.min(1, (maxX + 1) / width + PADDING),
    bottom: Math.min(1, (maxY + 1) / height + PADDING),
  };

  const widthSaved = 1 - (box.right - box.left);
  return widthSaved < WORTHWHILE ? WHOLE_PAGE : box;
}
