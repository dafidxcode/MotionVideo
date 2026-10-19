/**
 * HTTP Range Request parser compliant with RFC 7233 (BUG-22).
 * Correctly supports standard ranges (bytes=0-499), prefix ranges (bytes=500-),
 * and suffix ranges (bytes=-500, e.g. last 500 bytes requested by Safari/Chrome).
 */

export interface ParsedHttpRange {
  start: number;
  end: number;
}

export function parseHttpRange(
  rangeHeader: string | null,
  totalSize: number,
): ParsedHttpRange | null {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=") || totalSize <= 0) {
    return null;
  }

  const spec = rangeHeader.slice(6).trim();
  const dashIndex = spec.indexOf("-");
  if (dashIndex === -1) return null;

  const startStr = spec.slice(0, dashIndex).trim();
  const endStr = spec.slice(dashIndex + 1).trim();

  let start: number;
  let end: number;

  if (startStr === "") {
    // Suffix range: bytes=-500 (last 500 bytes)
    const suffixLength = parseInt(endStr, 10);
    if (isNaN(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, totalSize - suffixLength);
    end = totalSize - 1;
  } else {
    start = parseInt(startStr, 10);
    if (isNaN(start) || start < 0) return null;

    if (endStr === "") {
      // Open-ended range: bytes=500-
      end = totalSize - 1;
    } else {
      end = parseInt(endStr, 10);
      if (isNaN(end) || end < start) return null;
      end = Math.min(end, totalSize - 1);
    }
  }

  if (start >= totalSize || start > end) return null;
  return { start, end };
}
