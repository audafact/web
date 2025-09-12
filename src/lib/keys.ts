// apps/web/src/lib/keys.ts
export type Ext = "mp3" | "wav" | string;

export function slugify(input: string) {
  return input
    .toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function libOriginalKey(trackId: string, shortHash: string, ext: Ext) {
  return `library/originals/${trackId}-${shortHash}.${ext}`;
}

export function userUploadKey(userId: string, uuid: string, title: string, ext: Ext) {
  return `users/${userId}/uploads/${uuid}-${slugify(title)}.${ext}`;
}

