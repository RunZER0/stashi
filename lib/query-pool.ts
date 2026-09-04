import { Pool } from "pg";
import type { ManagedDatabase } from "./control-plane";
import { makeConnectionString } from "./control-plane";

// One pg.Pool per tenant database, reused across requests in this Node
// process instead of opening a fresh Client (full TCP + TLS + SCRAM
// handshake) on every single query. Measured live: with a fresh Client per
// request, a single `select 1` round-trip through PgBouncer took ~2.7-3.2s
// from this app to the VPS -- almost entirely connection setup, not the
// query itself. A warm pool pays that cost once per tenant, not once per
// tool call, which matters most for MCP/agent traffic making many small
// calls in a row.
//
// Small per-tenant max (this is one interactive/agent connection at a
// time, not a web app's traffic) and a short idle timeout so pools for
// databases nobody's actively querying don't sit open forever across
// potentially thousands of tenants sharing this process.
const pools = new Map<string, Pool>();
const IDLE_TIMEOUT_MS = 60_000;
const MAX_POOLS = 500;

function poolKey(db: ManagedDatabase) {
  return `${db.host}:${db.port}/${db.database}?user=${db.username}`;
}

export function getQueryPool(db: ManagedDatabase): Pool {
  const key = poolKey(db);
  let pool = pools.get(key);
  if (pool) return pool;

  // Simple eviction so a very long-lived process can't accumulate unbounded
  // pools if it happens to talk to hundreds of distinct databases without
  // ever restarting -- not a real concern at current scale, cheap to guard.
  if (pools.size >= MAX_POOLS) {
    const oldestKey = pools.keys().next().value;
    if (oldestKey) {
      pools.get(oldestKey)?.end().catch(() => {});
      pools.delete(oldestKey);
    }
  }

  pool = new Pool({
    connectionString: makeConnectionString(db),
    max: 3,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: 8000,
  });
  pool.on("error", (err) => {
    // A pooled client can go bad (network blip, PgBouncer restart) between
    // uses -- pg's pool emits this on idle clients rather than throwing, and
    // an unhandled 'error' event would crash the whole Node process.
    console.error(`[query-pool] idle client error for ${key}:`, err.message);
  });
  pools.set(key, pool);
  return pool;
}
