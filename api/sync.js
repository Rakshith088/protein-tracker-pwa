/* /api/sync — the whole backend: an authenticated blob store with a
   staleness check. Contract in docs/SYNC.md.

   Storage: Vercel KV / Upstash Redis over REST (zero npm dependencies —
   plain fetch against the store's REST endpoint). Key = sha256(token),
   value = the app's schema-4 export JSON, verbatim. */
"use strict";
const crypto = require("crypto");

const MAX_BYTES = 900 * 1024;          // Upstash free tier caps requests at 1 MB
const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;

function kvEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

/* generic Upstash REST command: POST base url with ["GET", key] etc. —
   the path-style /set/key/value would hit URL length limits on big blobs */
async function kv(cmd) {
  const env = kvEnv();
  const r = await fetch(env.url, {
    method: "POST",
    headers: { Authorization: "Bearer " + env.token, "Content-Type": "application/json" },
    body: JSON.stringify(cmd)
  });
  if (!r.ok) throw new Error("kv " + r.status);
  return (await r.json()).result;
}

function err(res, status, code, message, extra) {
  return res.status(status).json({ error: Object.assign({ code, message }, extra || {}) });
}

function bearerToken(req) {
  const m = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || "");
  return m && TOKEN_RE.test(m[1]) ? m[1] : null;
}

function keyFor(token) {
  return "pt:" + crypto.createHash("sha256").update(token).digest("hex");
}

/* boundary validation only — beyond this the server treats the blob as opaque */
function validPayload(d) {
  return d && typeof d === "object" &&
    d.app === "protein-tracker" &&
    typeof d.schema === "number" && d.schema >= 4 &&
    d.logs && typeof d.logs === "object" &&
    typeof d.exported === "string" && !isNaN(Date.parse(d.exported));
}

module.exports = async (req, res) => {
  if (!kvEnv()) return err(res, 503, "KV_UNAVAILABLE", "Storage is not configured — connect a KV store in Vercel.");

  const token = bearerToken(req);
  if (!token) return err(res, 401, "UNAUTHORIZED", "Missing or malformed bearer token.");
  const key = keyFor(token);

  try {
    if (req.method === "GET") {
      const stored = await kv(["GET", key]);
      if (stored == null) return err(res, 404, "NOT_FOUND", "Nothing synced for this token yet.");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "application/json");
      return res.status(200).send(stored);           // stored verbatim, already JSON text
    }

    if (req.method === "PUT") {
      const body = req.body;
      const data = typeof body === "string" ? safeParse(body) : body;
      if (!validPayload(data)) return err(res, 422, "INVALID_PAYLOAD", "Body is not a protein-tracker schema-4 export.");
      const text = JSON.stringify(data);
      if (Buffer.byteLength(text, "utf8") > MAX_BYTES)
        return err(res, 413, "TOO_LARGE", "Snapshot exceeds 900 KB.");

      // staleness check: never let an out-of-date device clobber a newer snapshot
      const stored = await kv(["GET", key]);
      if (stored != null) {
        const prev = safeParse(stored);
        if (prev && Date.parse(data.exported) < Date.parse(prev.exported))
          return err(res, 409, "STALE", "Server has a newer snapshot — pull, merge, retry.",
            { serverExported: prev.exported });
      }

      await kv(["SET", key, text]);
      return res.status(200).json({ ok: true, exported: data.exported });
    }

    res.setHeader("Allow", "GET, PUT");
    return err(res, 405, "METHOD_NOT_ALLOWED", "Use GET or PUT.");
  } catch (e) {
    return err(res, 503, "KV_UNAVAILABLE", "Storage backend error.");
  }
};

function safeParse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
