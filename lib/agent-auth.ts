import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SKEW_SECONDS = 300;

export type VerifyResult = { ok: true } | { ok: false; error: string; status: number };

// Verifies the HMAC-SHA256 signature the node agent (ops/node-agent/agent.js)
// attaches to every request, over the exact raw body bytes it signed — never
// re-serialize the parsed JSON for this, key order / number formatting drift
// would break legitimate requests.
export function verifyAgentSignature(rawBody: string, headers: Headers): VerifyResult {
  const secret = process.env.STASHI_AGENT_SHARED_SECRET;
  if (!secret) return { ok: false, error: "server_missing_shared_secret", status: 500 };

  const timestamp = headers.get("x-stashi-timestamp");
  const signature = headers.get("x-stashi-signature");
  if (!timestamp || !signature) return { ok: false, error: "missing_signature_headers", status: 401 };

  const skew = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(skew) || skew > MAX_SKEW_SECONDS) {
    return { ok: false, error: "stale_or_invalid_timestamp", status: 401 };
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const gotBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== gotBuf.length || !timingSafeEqual(expectedBuf, gotBuf)) {
    return { ok: false, error: "bad_signature", status: 401 };
  }

  return { ok: true };
}
