// tools/ingest-library.mjs
//
// Bulk-upload WAV/MP3 from a folder to R2 and upsert library_tracks in Supabase.
//
// Standard catalog (WAV, MP3, M4A):
//   LIBRARY_INBOX=./my-wavs node tools/ingest-library.mjs
//
// Cristian Sigler demo pack (same R2 layout; rows tagged with demo_collection_slug):
//   LIBRARY_INBOX=./sigler-pack node tools/ingest-library.mjs \
//     --demo-collection-key=demo_collection.cristian_sigler_drum_pack_v1 \
//     --artist="Cristian Sigler" \
//     --track-id-prefix=cs-dptv1
//
// Enable the pack in Supabase (no web redeploy) before the demo account can see tracks:
//   UPDATE public.app_config SET value = '{"enabled": true}'::jsonb
//   WHERE key = 'demo_collection.cristian_sigler_drum_pack_v1';
//
// Disable after the session:
//   UPDATE public.app_config SET value = '{"enabled": false}'::jsonb
//   WHERE key = 'demo_collection.cristian_sigler_drum_pack_v1';
//
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_DEMO_COLLECTION_KEY =
  "demo_collection.cristian_sigler_drum_pack_v1";

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

function parseArgs(argv) {
  /** @type {{ demoCollectionKey: string | null; artist: string | null; trackIdPrefix: string; inbox: string }} */
  const out = {
    demoCollectionKey: null,
    artist: null,
    trackIdPrefix: "cs-dptv1",
    inbox: LIBRARY_INBOX,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--demo-collection-key=")) {
      out.demoCollectionKey = a.slice("--demo-collection-key=".length).trim();
    } else if (a === "--demo-collection-key") {
      out.demoCollectionKey = DEFAULT_DEMO_COLLECTION_KEY;
    } else if (a.startsWith("--artist=")) {
      out.artist = a.slice("--artist=".length).trim() || null;
    } else if (a.startsWith("--track-id-prefix=")) {
      out.trackIdPrefix = a.slice("--track-id-prefix=".length).trim() || "cs-dptv1";
    } else if (a.startsWith("--inbox=")) {
      out.inbox = a.slice("--inbox=".length).trim() || LIBRARY_INBOX;
    }
  }
  return out;
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

/**
 * @param {object} p
 * @param {string} p.trackId
 * @param {string} p.name
 * @param {string} p.fileKey
 * @param {string} p.contentHash
 * @param {number} p.sizeBytes
 * @param {string} p.contentType
 * @param {'wav'|'mp3'|'m4a'} p.audioType
 * @param {string | null} p.demoCollectionKey
 * @param {string | null} p.artist
 */
async function upsertTrack({
  trackId,
  name,
  fileKey,
  contentHash,
  sizeBytes,
  contentType,
  audioType,
  demoCollectionKey,
  artist,
}) {
  const familyId = kebab(trackId);
  /** @type {Record<string, unknown>} */
  const row = {
    track_id: trackId,
    name,
    genre: demoCollectionKey ? ["drums"] : ["unsorted"],
    type: audioType,
    file_key: fileKey,
    content_hash: contentHash,
    size_bytes: sizeBytes,
    content_type: contentType,
    is_active: true,
    is_pro_only: false,
    family_id: familyId,
    variant_type: "primary",
    variant_number: 0,
    display_rank: 0,
    tags: [],
    demo_collection_slug: demoCollectionKey,
    artist,
  };
  const { error } = await supa.from("library_tracks").upsert(row, {
    onConflict: "track_id",
  });
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
  const args = parseArgs(process.argv);
  const dir = path.resolve(args.inbox);
  const files = fs.readdirSync(dir).filter((f) => /\.(wav|mp3|m4a)$/i.test(f));
  if (!files.length) {
    console.log("No WAV/MP3/M4A files found in", dir);
    return;
  }

  if (args.demoCollectionKey) {
    console.log(
      "Demo collection mode:",
      args.demoCollectionKey,
      "artist=",
      args.artist ?? "(none)",
      "trackIdPrefix=",
      args.trackIdPrefix
    );
  }

  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    const base = f.replace(/\.[^.]+$/, "");
    const ext = (path.extname(f).slice(1) || "wav").toLowerCase();
    /** @type {'wav'|'mp3'|'m4a'} */
    const audioType =
      ext === "wav" ? "wav" : ext === "m4a" ? "m4a" : "mp3";
    const uploadContentType =
      ext === "wav"
        ? "audio/wav"
        : ext === "m4a"
          ? "audio/mp4"
          : "audio/mpeg";
    const dbContentType = uploadContentType;

    const slug = kebab(base);
    const trackId = args.demoCollectionKey
      ? `${args.trackIdPrefix}-${slug}`
      : slug;

    const digest = await sha256File(full);
    const s = shortHex(digest, 10);
    const key = libOriginalKey(trackId, s, ext);

    console.log("→", f, "=>", key);

    await uploadR2(key, full, uploadContentType);
    await upsertTrack({
      trackId,
      name: base,
      fileKey: key,
      contentHash: digest,
      sizeBytes: stat.size,
      contentType: dbContentType,
      audioType,
      demoCollectionKey: args.demoCollectionKey,
      artist: args.artist,
    });
  }
  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
