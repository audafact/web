// src/utils/media.ts
/** 12.3MB / 850.2KB style formatting */
export function toPrettySize(bytes?: number | null, fallback = "0MB") {
  if (bytes == null) return fallback;
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Legacy compatibility:
 * Converts an old public URL into a storage key.
 * If it’s just a filename, lift it into library/{originals|previews}/<filename>.
 * For user uploads where you can’t infer uid, park under users/unknown/uploads.
 */
export function normalizeLegacyUrlToKey(
  url: string,
  opts?: { isPreview?: boolean; userIdHint?: string }
) {
  const isPreview = !!opts?.isPreview;
  const noQuery = url.split("?")[0];
  const filename = noQuery.split("/").pop() || noQuery;

  // Already looks like a key?
  if (
    filename.includes("/") &&
    (filename.startsWith("library/") ||
      filename.startsWith("users/") ||
      filename.startsWith("sessions/"))
  ) {
    return filename;
  }

  // If this is a library asset
  if (!opts?.userIdHint) {
    return isPreview
      ? `library/previews/${filename}`
      : `library/originals/${filename}`;
  }

  // If this is a user upload and you know the user id:
  return `users/${opts.userIdHint}/uploads/${filename}`;
}
