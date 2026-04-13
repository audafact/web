#!/usr/bin/env node
/**
 * Copy public.sessions and public.recordings for a user from production → staging.
 *
 * Remaps auth.users id: production row user_id is replaced with the staging user's id.
 * Preserves session/recording primary keys so session_id on recordings stays valid.
 *
 * Does NOT copy R2 objects. If staging uses a different bucket or key layout, copy the
 * file separately or update recordings.file_key / recording_url after this runs.
 *
 * Usage (from web/):
 *   PROD_DATABASE_URL='postgresql://postgres:PASS@db.<prod-ref>.supabase.co:5432/postgres?sslmode=require' \
 *   STAGING_DATABASE_URL='postgresql://postgres@db.<staging-ref>.supabase.co:5432/postgres?sslmode=require' \
 *   STAGING_DB_PASSWORD='raw-password-with-@and#' \
 *   node scripts/migrate-sessions-recordings-to-staging.mjs --email=demo@audafact.com
 *
 * If a DB password contains reserved URI characters (@ # / etc.), either percent-encode it in the URL
 * or omit it from the URL and set PROD_DB_PASSWORD / STAGING_DB_PASSWORD (recommended).
 *
 * Options:
 *   --email=<addr>        User email (required)
 *   --dry-run             Print actions only
 *   --session-id=<uuid>   Only this session + recordings linked to it (and user)
 *   --recording-id=<uuid> Only this recording (must belong to user on prod)
 *
 * Env:
 *   PROD_DATABASE_URL, STAGING_DATABASE_URL (or --prod-url / --staging-url)
 *   PROD_DB_PASSWORD, STAGING_DB_PASSWORD — optional; when set, override password from URL
 */

import pg from "pg";
import { parse } from "pg-connection-string";

const { Client } = pg;

/**
 * @param {string} url
 * @param {string | undefined} passwordOverride
 * @param {string} envVarName e.g. PROD_DB_PASSWORD (for logs only)
 */
function buildClientConfig(url, passwordOverride, envVarName) {
  const trimmed = url.trim();
  const parsed = parse(trimmed);
  const { ssl: _sslFromUrl, sslmode: _sslmode, ...rest } = parsed;
  const host = rest.host ?? "";
  const useTls = host !== "" && !/^(localhost|127\.0\.0\.1)$/i.test(host);
  const hasOverride =
    passwordOverride !== undefined && String(passwordOverride).length > 0;
  const password = hasOverride ? passwordOverride : rest.password;
  let passwordSource;
  if (hasOverride) {
    passwordSource = envVarName;
  } else if (rest.password !== undefined && rest.password !== "") {
    passwordSource = "embedded in URL";
  } else {
    passwordSource = "missing (set password in URL or " + envVarName + ")";
  }
  return {
    clientOptions: {
      ...rest,
      password,
      ssl: useTls ? { rejectUnauthorized: false } : false,
    },
    summary: {
      host,
      port: rest.port ?? "5432",
      user: rest.user ?? "postgres",
      database: rest.database ?? "postgres",
      passwordSource,
    },
  };
}

function parseArgs(argv) {
  /** @type {{ email?: string, dryRun: boolean, sessionId?: string, recordingId?: string, prodUrl?: string, stagingUrl?: string }} */
  const out = { dryRun: false };
  for (const a of argv) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a.startsWith("--email=")) out.email = a.slice("--email=".length);
    else if (a.startsWith("--session-id=")) out.sessionId = a.slice("--session-id=".length);
    else if (a.startsWith("--recording-id=")) out.recordingId = a.slice("--recording-id=".length);
    else if (a.startsWith("--prod-url=")) out.prodUrl = a.slice("--prod-url=".length);
    else if (a.startsWith("--staging-url=")) out.stagingUrl = a.slice("--staging-url=".length);
  }
  return out;
}

/**
 * Build a pg Client config so TLS works with Supabase and typical dev laptops.
 * `connectionString` + `sslmode=require` is merged by pg in a way that can still
 * verify the cert chain (Node) and fail with SELF_SIGNED_CERT_IN_CHAIN behind some
 * proxies; forcing ssl here avoids that.
 *
 * @param {ReturnType<typeof buildClientConfig>["clientOptions"]} opts
 */
function createClient(opts) {
  return new Client(opts);
}

/** @param {string} email */
async function authUserId(client, email) {
  const r = await client.query(
    `SELECT id FROM auth.users WHERE lower(email) = lower($1) LIMIT 1`,
    [email]
  );
  return r.rows[0]?.id ?? null;
}

/**
 * @template T
 * @param {T} row
 * @param {string} prodUid
 * @param {string} stagingUid
 */
function remapUserId(row, prodUid, stagingUid) {
  if (row.user_id !== prodUid) {
    throw new Error(`Row user_id ${row.user_id} does not match prod user ${prodUid}`);
  }
  return { ...row, user_id: stagingUid };
}

const SESSIONS_JSONB_COLS = new Set(["cuepoints", "loop_regions", "full_state"]);
const RECORDINGS_JSONB_COLS = new Set(["performance_events", "performance_meta"]);

/**
 * Jsonb via bound params: stringify + ::jsonb avoids node-pg / Postgres JSON parsing
 * mismatches on nested structures (22P02 invalid input syntax for type json).
 *
 * @param {unknown} value
 * @param {string} columnName
 */
function toJsonbParam(value, columnName) {
  if (value == null) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return JSON.stringify(parsed, (_k, v) =>
      typeof v === "bigint" ? v.toString() : v
    );
  } catch (e) {
    throw new Error(`Invalid jsonb for column "${columnName}": ${e.message}`);
  }
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} table
 */
function buildUpsert(table, row) {
  const jsonbCols =
    table === "sessions"
      ? SESSIONS_JSONB_COLS
      : table === "recordings"
        ? RECORDINGS_JSONB_COLS
        : new Set();

  const keys = Object.keys(row).filter((k) => row[k] !== undefined).sort();
  if (keys.length === 0) throw new Error("Empty row");
  const quoted = keys.map((k) => `"${k}"`);
  const placeholders = keys.map((k, i) => {
    const n = i + 1;
    return jsonbCols.has(k) ? `$${n}::jsonb` : `$${n}`;
  });
  const values = keys.map((k) =>
    jsonbCols.has(k) ? toJsonbParam(row[k], k) : row[k]
  );
  const updates = keys
    .filter((k) => k !== "id")
    .map((k) => `"${k}" = EXCLUDED."${k}"`)
    .join(", ");
  return {
    text: `INSERT INTO public.${table} (${quoted.join(", ")}) VALUES (${placeholders.join(", ")}) ON CONFLICT ("id") DO UPDATE SET ${updates}`,
    values,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = args.email?.trim();
  const prodUrl = args.prodUrl ?? process.env.PROD_DATABASE_URL;
  const stagingUrl = args.stagingUrl ?? process.env.STAGING_DATABASE_URL;

  if (!email) {
    console.error("Usage: set --email=user@example.com and PROD_DATABASE_URL / STAGING_DATABASE_URL");
    process.exit(1);
  }
  if (!prodUrl?.trim()) {
    console.error("Set PROD_DATABASE_URL or --prod-url=postgresql://...");
    process.exit(1);
  }
  if (!stagingUrl?.trim()) {
    console.error("Set STAGING_DATABASE_URL or --staging-url=postgresql://...");
    process.exit(1);
  }

  const prodCfg = buildClientConfig(
    prodUrl,
    process.env.PROD_DB_PASSWORD,
    "PROD_DB_PASSWORD"
  );
  const stagingCfg = buildClientConfig(
    stagingUrl,
    process.env.STAGING_DB_PASSWORD,
    "STAGING_DB_PASSWORD"
  );

  const prodSummary = prodCfg.summary;
  const stagingSummary = stagingCfg.summary;
  console.log(
    `Production target:  ${prodSummary.user}@${prodSummary.host}:${prodSummary.port}/${prodSummary.database} (password: ${prodSummary.passwordSource})`
  );
  console.log(
    `Staging target:     ${stagingSummary.user}@${stagingSummary.host}:${stagingSummary.port}/${stagingSummary.database} (password: ${stagingSummary.passwordSource})`
  );
  console.log(
    "(Password values are never printed. Auth order: production first, then staging.)\n"
  );

  const prod = createClient(prodCfg.clientOptions);
  const staging = createClient(stagingCfg.clientOptions);

  try {
    await prod.connect();
  } catch (e) {
    console.error(
      "Failed to connect to PRODUCTION — fix PROD_DATABASE_URL / PROD_DB_PASSWORD for the host above (not staging)."
    );
    throw e;
  }
  try {
    await staging.connect();
  } catch (e) {
    console.error(
      "Failed to connect to STAGING — fix STAGING_DATABASE_URL / STAGING_DB_PASSWORD for the host above."
    );
    throw e;
  }

  try {
    const prodUid = await authUserId(prod, email);
    const stagingUid = await authUserId(staging, email);

    if (!prodUid) {
      console.error(`No auth.users row for email on PROD: ${email}`);
      process.exit(1);
    }
    if (!stagingUid) {
      console.error(`No auth.users row for email on STAGING: ${email}`);
      process.exit(1);
    }

    console.log(`Prod user id:    ${prodUid}`);
    console.log(`Staging user id: ${stagingUid}`);

    let sessionsSql = `SELECT * FROM public.sessions WHERE user_id = $1`;
    const sessionsParams = [prodUid];
    if (args.sessionId) {
      sessionsSql += ` AND id = $2`;
      sessionsParams.push(args.sessionId);
    }

    /** @type {Record<string, any>[]} */
    let prodSessions = (await prod.query(sessionsSql, sessionsParams)).rows;

    let recSql = `SELECT * FROM public.recordings WHERE user_id = $1`;
    const recParams = [prodUid];
    if (args.recordingId) {
      recSql += ` AND id = $2`;
      recParams.push(args.recordingId);
    } else if (args.sessionId) {
      recSql += ` AND session_id = $2`;
      recParams.push(args.sessionId);
    }

    /** @type {Record<string, any>[]} */
    let prodRecordings = (await prod.query(recSql, recParams)).rows;

    // If copying a single recording, include its parent session so FK and studio restore work.
    const sessionIds = new Set(prodSessions.map((s) => s.id));
    for (const r of prodRecordings) {
      if (r.session_id && !sessionIds.has(r.session_id)) {
        const extra = await prod.query(
          `SELECT * FROM public.sessions WHERE id = $1 AND user_id = $2`,
          [r.session_id, prodUid]
        );
        if (extra.rows[0]) {
          prodSessions.push(extra.rows[0]);
          sessionIds.add(r.session_id);
        }
      }
    }

    if (args.sessionId && prodSessions.length === 0) {
      console.error(`No session ${args.sessionId} for this user on prod.`);
      process.exit(1);
    }
    if (args.recordingId && prodRecordings.length === 0) {
      console.error(`No recording ${args.recordingId} for this user on prod.`);
      process.exit(1);
    }

    console.log(`\nProd: ${prodSessions.length} session(s), ${prodRecordings.length} recording(s) to copy.`);

    if (args.dryRun) {
      prodSessions.forEach((s) => console.log("  [dry-run] session", s.id, s.session_name));
      prodRecordings.forEach((r) => console.log("  [dry-run] recording", r.id, r.session_id));
      return;
    }

    await staging.query("BEGIN");
    try {
      for (const s of prodSessions) {
        const row = remapUserId(s, prodUid, stagingUid);
        const q = buildUpsert("sessions", row);
        await staging.query(q.text, q.values);
        console.log("  upsert session", row.id, row.session_name);
      }
      for (const r of prodRecordings) {
        const row = remapUserId(r, prodUid, stagingUid);
        const q = buildUpsert("recordings", row);
        await staging.query(q.text, q.values);
        console.log("  upsert recording", row.id, "session_id=", row.session_id);
      }
      await staging.query("COMMIT");
    } catch (e) {
      await staging.query("ROLLBACK");
      throw e;
    }

    console.log("\nDone. Verify rows in staging and that R2 keys resolve if you use per-env buckets.");
  } finally {
    await prod.end().catch(() => {});
    await staging.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
