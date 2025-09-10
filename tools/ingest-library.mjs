// tools/ingest-library.mjs
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

// --- env ---
const {
  R2_ENDPOINT,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE,
  LIBRARY_INBOX = "assets/library-inbox",
} = process.env;
if (
  !R2_ENDPOINT ||
  !R2_ACCESS_KEY_ID ||
  !R2_SECRET_ACCESS_KEY ||
  !R2_BUCKET ||
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE
) {
  console.error(
    "Missing required envs. Create .env.ingest (see instructions)."
  );
  process.exit(1);
}

// --- clients ---
const r2 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});
const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// --- helpers ---
const shortHex = (hex, n = 10) => hex.slice(0, n);
const kebab = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const libOriginalKey = (trackId, shortHash, ext) =>
  `library/originals/${trackId}-${shortHash}.${ext}`;

async function sha256File(filePath) {
  const h = createHash("sha256");
  await new Promise((res, rej) => {
    fs.createReadStream(filePath)
      .on("data", (c) => h.update(c))
      .on("error", rej)
      .on("end", res);
  });
  return h.digest("hex");
}

async function upsertTrack({
  trackId,
  name,
  fileKey,
  contentHash,
  sizeBytes,
  contentType,
}) {
  const { error } = await supa.from("library_tracks").upsert(
    {
      track_id: trackId,
      name,
      genre: "unsorted",
      type: "wav",
      file_key: fileKey,
      content_hash: contentHash,
      size_bytes: sizeBytes,
      content_type: contentType,
      is_active: true,
    },
    { onConflict: "track_id" }
  );
  if (error) throw error;
}

async function uploadR2(key, filePath, contentType) {
  const Body = fs.createReadStream(filePath);
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body,
      ContentType: contentType,
    })
  );
}

// --- main ---
async function run() {
  const dir = path.resolve(LIBRARY_INBOX);
  const files = fs.readdirSync(dir).filter((f) => /\.(wav|mp3)$/i.test(f));
  if (!files.length) {
    console.log("No WAV/MP3 files found in", dir);
    return;
  }
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    const base = f.replace(/\.[^.]+$/, "");
    const ext = (path.extname(f).slice(1) || "wav").toLowerCase();

    // You can choose your own track_id. Here we default to a kebab of the base name.
    const trackId = kebab(base);

    const digest = await sha256File(full);
    const s = shortHex(digest, 10);
    const key = libOriginalKey(trackId, s, ext);

    console.log("→", f, "=>", key);

    await uploadR2(key, full, ext === "wav" ? "audio/wav" : "audio/mpeg");
    await upsertTrack({
      trackId,
      name: base,
      fileKey: key,
      contentHash: digest,
      sizeBytes: stat.size,
      contentType: ext === "wav" ? "audio/wav" : "audio/mpeg",
    });
  }
  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
