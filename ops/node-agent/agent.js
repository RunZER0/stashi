/**
 * Stashi Production Node Agent
 * Lightweight outbound-polling worker that executes administrative database jobs,
 * enforces multi-tenant isolation, captures lightweight telemetry, and reports capacity.
 */

const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const https = require("https");
const http = require("http");

// Configuration from Environment
const NODE_ID = process.env.STASHI_NODE_ID || "node-nj-01";
const REGION = process.env.STASHI_REGION || "us-east";
const CONTROL_PLANE_URL = process.env.STASHI_CONTROL_PLANE_URL || "http://127.0.0.1:3000";
const SHARED_SECRET = process.env.STASHI_AGENT_SHARED_SECRET || "dev_stashi_secret_key";
const POLL_INTERVAL = parseInt(process.env.STASHI_JOB_POLL_INTERVAL_SEC || "5", 10) * 1000;
const METRICS_INTERVAL = parseInt(process.env.STASHI_METRICS_INTERVAL_SEC || "60", 10) * 1000;
const CHECKPOINT_DIR = "/var/backups/stashi/checkpoints";
const BRANCH_DIR = "/var/backups/stashi/branches";

const cleanIdent = (value) => String(value || "").replace(/[^a-zA-Z0-9_]/g, "");

// Execute PostgreSQL commands safely via sudo -u postgres psql
function runPsql(sql, args = []) {
  return new Promise((resolve, reject) => {
    execFile(
      "sudo",
      ["-u", "postgres", "psql", "-At", "-c", sql, ...args],
      (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(`psql error: ${stderr || error.message}`));
        }
        resolve(stdout.trim());
      }
    );
  });
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve(stdout);
    });
  });
}

// pg_dump/pg_restore run as the postgres OS user so the file is owned by it,
// consistent with everything else psql-related the agent does.
function runAsPostgres(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile("sudo", ["-u", "postgres", cmd, ...args], (error, stdout, stderr) => {
      // pg_restore commonly exits non-zero on benign notices (e.g. "already
      // exists" skip warnings on a fresh target). Only treat FATAL/PANIC in
      // stderr as a real failure, same leniency ops/scripts/restore.sh uses.
      if (error && /FATAL|PANIC/i.test(stderr || "")) {
        return reject(new Error(stderr));
      }
      resolve(stdout);
    });
  });
}

// Unlike runAsPostgres(), this treats any non-zero exit as a real failure —
// used for the one place a partial, undetected failure would actually
// matter: restoring a branch's plain-SQL dump under ON_ERROR_STOP=1, where
// psql's own error text won't necessarily say FATAL/PANIC the way
// pg_restore's benign "already exists" notices do.
function runAsPostgresStrict(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile("sudo", ["-u", "postgres", cmd, ...args], (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve(stdout);
    });
  });
}

function reloadPgbouncerAuth(roleName, scramHashOrRemove) {
  if (!fs.existsSync("/etc/pgbouncer/userlist.txt")) return;
  const lines = fs
    .readFileSync("/etc/pgbouncer/userlist.txt", "utf8")
    .split("\n")
    .filter((l) => !l.startsWith(`"${roleName}"`));
  if (scramHashOrRemove) lines.push(`"${roleName}" "${scramHashOrRemove}"`);
  fs.writeFileSync("/etc/pgbouncer/userlist.txt", lines.filter(Boolean).join("\n") + "\n");
  execFile("sudo", ["systemctl", "reload", "pgbouncer"], () => {});
}

// Generate HMAC signature for control plane requests
function signPayload(payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const data = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto.createHmac("sha256", SHARED_SECRET).update(data).digest("hex");
  return { timestamp, signature };
}

// Post request to control plane
function postControlPlane(path, payload) {
  return new Promise((resolve, reject) => {
    const { timestamp, signature } = signPayload(payload);
    const body = JSON.stringify(payload);
    const parsedUrl = new URL(`${CONTROL_PLANE_URL}${path}`);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const req = client.request(
      parsedUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Stashi-Node-Id": NODE_ID,
          "X-Stashi-Timestamp": timestamp.toString(),
          "X-Stashi-Signature": signature,
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 10000,
      },
      (res) => {
        let responseData = "";
        res.on("data", (chunk) => (responseData += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(responseData || "{}"));
            } catch (e) {
              resolve({});
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// Job Handlers
const JobHandlers = {
  // 1. Create Tenant Database & Role (isolated: Starter and up)
  async create_database({ database_name, role_name, password, connection_limit = 10 }) {
    const cleanDb = cleanIdent(database_name);
    const cleanRole = cleanIdent(role_name);
    console.log(`[Job] Creating database: ${cleanDb} for role: ${cleanRole}`);

    await runPsql(
      `CREATE ROLE "${cleanRole}" WITH LOGIN PASSWORD '${password.replace(/'/g, "''")}' NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT ${parseInt(connection_limit, 10)};`
    );
    await runPsql(`CREATE DATABASE "${cleanDb}" WITH OWNER = "${cleanRole}";`);
    await runPsql(`REVOKE ALL ON DATABASE "${cleanDb}" FROM PUBLIC;`);
    await runPsql(`GRANT ALL ON DATABASE "${cleanDb}" TO "${cleanRole}";`);
    // Pre-installed as superuser so agent-memory tables (vector columns) work
    // out of the box — a plain tenant role can't CREATE EXTENSION itself
    // (pgvector isn't marked "trusted"), but it can freely create tables
    // using a type the extension already provides in this database.
    await runPsql(`CREATE EXTENSION IF NOT EXISTS vector;`, ["-d", cleanDb]);

    if (fs.existsSync("/etc/pgbouncer/userlist.txt")) {
      const scramHash = await runPsql(`SELECT rolpassword FROM pg_authid WHERE rolname = '${cleanRole}';`);
      reloadPgbouncerAuth(cleanRole, scramHash);
    }

    return { status: "ready", database: cleanDb, role: cleanRole };
  },

  // 1b. Create a pooled tenant: a schema inside the shared stashi_pool
  // database, isolated by Postgres's own permission model rather than a
  // dedicated instance. This is how the Dev ($1/mo) tier stays cheap.
  async create_pool_tenant({ pool_database, schema_name, role_name, password, connection_limit = 10 }) {
    const cleanDb = cleanIdent(pool_database);
    const cleanSchema = cleanIdent(schema_name);
    const cleanRole = cleanIdent(role_name);
    console.log(`[Job] Creating pooled tenant schema: ${cleanSchema} (role ${cleanRole}) in ${cleanDb}`);

    await runPsql(
      `CREATE ROLE "${cleanRole}" WITH LOGIN PASSWORD '${password.replace(/'/g, "''")}' NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT ${parseInt(connection_limit, 10)};`
    );
    await runPsql(`GRANT CONNECT, TEMP ON DATABASE "${cleanDb}" TO "${cleanRole}";`);
    // Idempotent and shared across every pool tenant — pgvector only needs
    // installing once per database, not once per schema, so this is a cheap
    // no-op after the first tenant.
    await runPsql(`CREATE EXTENSION IF NOT EXISTS vector;`, ["-d", cleanDb]);
    await runPsql(`CREATE SCHEMA "${cleanSchema}" AUTHORIZATION "${cleanRole}";`, ["-d", cleanDb]);
    // Role-level default: applied automatically on every future connection to
    // this database, including through PgBouncer's transaction pooling
    // (unlike a session-level SET, which pooling would not preserve).
    await runPsql(`ALTER ROLE "${cleanRole}" IN DATABASE "${cleanDb}" SET search_path = "${cleanSchema}";`);

    if (fs.existsSync("/etc/pgbouncer/userlist.txt")) {
      const scramHash = await runPsql(`SELECT rolpassword FROM pg_authid WHERE rolname = '${cleanRole}';`);
      reloadPgbouncerAuth(cleanRole, scramHash);
    }

    return { status: "ready", database: cleanDb, schema: cleanSchema, role: cleanRole };
  },

  // 1c. Branch: a real logical copy of the source's current data into a
  // brand-new role + schema/database, via the same pg_dump/pg_restore
  // machinery checkpoints use — just restored into a new target instead of
  // back onto the source. Deliberately not `CREATE DATABASE ... TEMPLATE`,
  // which requires exclusive access to the template database (no other
  // connections allowed); dump/restore works even while the source is live.
  async create_branch({
    source_pool_database,
    source_schema_name,
    source_database_name,
    target_pool_database,
    target_schema_name,
    target_database_name,
    role_name,
    password,
    connection_limit = 10,
  }) {
    const cleanRole = cleanIdent(role_name);
    const dumpPath = `${BRANCH_DIR}/${cleanRole}.dump`;
    await run("mkdir", ["-p", BRANCH_DIR]);
    await run("chown", ["-R", "postgres:postgres", "/var/backups/stashi"]);

    const pooled = Boolean(source_pool_database && source_schema_name);
    console.log(`[Job] Branching ${pooled ? source_schema_name : source_database_name} -> ${cleanRole}`);

    if (pooled) {
      const cleanSourceDb = cleanIdent(source_pool_database);
      const cleanSourceSchema = cleanIdent(source_schema_name);
      const cleanTargetDb = cleanIdent(target_pool_database);
      const cleanTargetSchema = cleanIdent(target_schema_name);

      // Pooled tenants all share ONE physical database (stashi_pool), and
      // source/target are that same database — so "restore into a
      // same-named schema, then rename" doesn't work here: the source
      // schema name is permanently occupied by the live source tenant in
      // this very database, not just temporarily during restore. Instead,
      // dump in plain SQL (not the usual -Fc custom format) so the schema
      // name can be text-replaced before restoring: pg_dump -n emits a
      // `SET search_path = <schema>` directive followed by unqualified
      // CREATE TABLE statements, so rewriting that one identifier
      // redirects the whole dump into the target schema.
      const sqlDumpPath = `${BRANCH_DIR}/${cleanRole}.sql`;
      // --no-owner / --no-privileges: without these, the dump's ALTER
      // TABLE ... OWNER TO / GRANT statements reference the SOURCE
      // tenant's role by name (the schema-rename sed below only touches
      // the schema identifier, not the role) — restored objects would
      // silently end up owned by the wrong tenant. Ownership is
      // transferred explicitly to the branch's own role after restore
      // instead, scoped only to its new schema.
      await runAsPostgres("pg_dump", ["--format=plain", "--no-owner", "--no-privileges", "-n", cleanSourceSchema, "-f", sqlDumpPath, cleanSourceDb]);
      await run("sed", ["-i", `s/\\b${cleanSourceSchema}\\b/${cleanTargetSchema}/g`, sqlDumpPath]);
      // pg_dump's plain output includes its own `CREATE SCHEMA` for the
      // dumped schema (now renamed to the target above) — but the target
      // schema is already pre-created below with the right owner, so make
      // the dump's copy an IF NOT EXISTS no-op rather than a collision.
      await run("sed", ["-i", `s/^CREATE SCHEMA ${cleanTargetSchema};/CREATE SCHEMA IF NOT EXISTS ${cleanTargetSchema};/`, sqlDumpPath]);
      await run("chown", ["postgres:postgres", sqlDumpPath]);

      await runPsql(
        `CREATE ROLE "${cleanRole}" WITH LOGIN PASSWORD '${password.replace(/'/g, "''")}' NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT ${parseInt(connection_limit, 10)};`
      );
      await runPsql(`GRANT CONNECT, TEMP ON DATABASE "${cleanTargetDb}" TO "${cleanRole}";`);
      await runPsql(`CREATE EXTENSION IF NOT EXISTS vector;`, ["-d", cleanTargetDb]);
      await runPsql(`CREATE SCHEMA "${cleanTargetSchema}" AUTHORIZATION "${cleanRole}";`, ["-d", cleanTargetDb]);
      await runAsPostgresStrict("psql", ["-v", "ON_ERROR_STOP=1", "-d", cleanTargetDb, "-f", sqlDumpPath]);
      // --no-owner leaves every restored table/sequence owned by postgres
      // (whoever ran the restore) — hand real ownership to the branch's
      // own role, scoped strictly to its own schema so this can't touch
      // any other tenant's objects in this shared database.
      await runPsql(
        `DO $$ DECLARE r record; BEGIN
           FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = '${cleanTargetSchema}' LOOP
             EXECUTE format('ALTER TABLE %I.%I OWNER TO %I', '${cleanTargetSchema}', r.tablename, '${cleanRole}');
           END LOOP;
           FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = '${cleanTargetSchema}' LOOP
             EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO %I', '${cleanTargetSchema}', r.sequencename, '${cleanRole}');
           END LOOP;
         END $$;`,
        ["-d", cleanTargetDb]
      );
      await runPsql(`ALTER ROLE "${cleanRole}" IN DATABASE "${cleanTargetDb}" SET search_path = "${cleanTargetSchema}";`);
    } else {
      const cleanSourceDb = cleanIdent(source_database_name);
      const cleanTargetDb = cleanIdent(target_database_name);

      // --no-owner / --no-privileges for the same reason as the pooled
      // path above: without them, restored objects come back owned by the
      // SOURCE database's role (embedded in the dump), not this branch's
      // own new role. Reassigned explicitly after restore instead.
      await runAsPostgres("pg_dump", ["-Fc", "--compress=zstd:3", "--no-owner", "--no-privileges", "-f", dumpPath, cleanSourceDb]);

      await runPsql(
        `CREATE ROLE "${cleanRole}" WITH LOGIN PASSWORD '${password.replace(/'/g, "''")}' NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT ${parseInt(connection_limit, 10)};`
      );
      await runPsql(`CREATE DATABASE "${cleanTargetDb}" WITH OWNER = "${cleanRole}";`);
      await runPsql(`REVOKE ALL ON DATABASE "${cleanTargetDb}" FROM PUBLIC;`);
      await runPsql(`GRANT ALL ON DATABASE "${cleanTargetDb}" TO "${cleanRole}";`);
      await runPsql(`CREATE EXTENSION IF NOT EXISTS vector;`, ["-d", cleanTargetDb]);
      await runAsPostgres("pg_restore", ["-d", cleanTargetDb, dumpPath]);
      // A dedicated single-tenant database (not shared like stashi_pool),
      // so reassigning everything in its default schema is safe — nothing
      // else lives in it.
      await runPsql(
        `DO $$ DECLARE r record; BEGIN
           FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
             EXECUTE format('ALTER TABLE %I.%I OWNER TO %I', 'public', r.tablename, '${cleanRole}');
           END LOOP;
           FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
             EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO %I', 'public', r.sequencename, '${cleanRole}');
           END LOOP;
         END $$;`,
        ["-d", cleanTargetDb]
      );
    }

    if (fs.existsSync("/etc/pgbouncer/userlist.txt")) {
      const scramHash = await runPsql(`SELECT rolpassword FROM pg_authid WHERE rolname = '${cleanRole}';`);
      reloadPgbouncerAuth(cleanRole, scramHash);
    }

    await run("rm", ["-f", dumpPath, `${BRANCH_DIR}/${cleanRole}.sql`]);
    return { status: "ready", role: cleanRole };
  },

  // 2. Rotate Credentials
  async rotate_credentials({ role_name, new_password }) {
    const cleanRole = cleanIdent(role_name);
    await runPsql(`ALTER ROLE "${cleanRole}" WITH PASSWORD '${new_password.replace(/'/g, "''")}';`);

    if (fs.existsSync("/etc/pgbouncer/userlist.txt")) {
      const scramHash = await runPsql(`SELECT rolpassword FROM pg_authid WHERE rolname = '${cleanRole}';`);
      reloadPgbouncerAuth(cleanRole, scramHash);
    }

    return { status: "rotated", role: cleanRole };
  },

  // 3. Suspend Database Access
  async suspend_database({ role_name }) {
    const cleanRole = cleanIdent(role_name);
    await runPsql(`ALTER ROLE "${cleanRole}" NOLOGIN;`);
    await runPsql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = '${cleanRole}';`);
    return { status: "suspended", role: cleanRole };
  },

  // 4. Resume Database Access
  async resume_database({ role_name }) {
    const cleanRole = cleanIdent(role_name);
    await runPsql(`ALTER ROLE "${cleanRole}" LOGIN;`);
    return { status: "resumed", role: cleanRole };
  },

  // 5. Delete Database (isolated)
  async delete_database({ database_name, role_name }) {
    const cleanDb = cleanIdent(database_name);
    const cleanRole = cleanIdent(role_name);

    if (cleanDb.toLowerCase() === "ynai" || cleanRole.toLowerCase().includes("ynai")) {
      throw new Error("Safety violation: Cannot drop core production database!");
    }

    await runPsql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${cleanDb}';`);
    await runPsql(`DROP DATABASE IF EXISTS "${cleanDb}";`);
    await runPsql(`DROP ROLE IF EXISTS "${cleanRole}";`);
    reloadPgbouncerAuth(cleanRole, null);

    return { status: "deleted", database: cleanDb };
  },

  // 5b. Delete a pooled tenant (drop just their schema, never the shared db)
  async delete_pool_tenant({ pool_database, schema_name, role_name }) {
    const cleanDb = cleanIdent(pool_database);
    const cleanSchema = cleanIdent(schema_name);
    const cleanRole = cleanIdent(role_name);

    await runPsql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = '${cleanRole}';`);
    await runPsql(`DROP SCHEMA IF EXISTS "${cleanSchema}" CASCADE;`, ["-d", cleanDb]);
    // create_pool_tenant grants CONNECT/TEMP on the shared database itself;
    // that grant is a real dependency and blocks DROP ROLE until revoked
    // (confirmed live: "role ... cannot be dropped because some objects
    // depend on it — privileges for database stashi_pool").
    await runPsql(`REVOKE ALL ON DATABASE "${cleanDb}" FROM "${cleanRole}";`);
    await runPsql(`DROP ROLE IF EXISTS "${cleanRole}";`);
    reloadPgbouncerAuth(cleanRole, null);

    return { status: "deleted", schema: cleanSchema };
  },

  // 6. Health Probe
  async health_probe() {
    const version = await runPsql("SELECT version();");
    return { status: "healthy", version };
  },

  // 7. Resize plan (connection limit today; storage is monitored, not
  // filesystem-enforced — see ops/plan-limits.md)
  async resize_plan({ role_name, connection_limit }) {
    const cleanRole = cleanIdent(role_name);
    await runPsql(`ALTER ROLE "${cleanRole}" CONNECTION LIMIT ${parseInt(connection_limit, 10)};`);
    return { status: "resized", role: cleanRole, connection_limit };
  },

  // 8. Create a checkpoint/backup — a real pg_dump, stored on this node.
  // "backup"-kind checkpoints additionally push to off-node S3-compatible
  // storage (Backblaze B2) when R2_ENDPOINT_URL/R2_BUCKET are configured;
  // "checkpoint"-kind ones (the fast, agent-triggered rollback mechanism)
  // stay local-only — speed matters more there than long-term retention.
  // The local copy is always kept either way, so restore never depends on
  // the network round trip having succeeded.
  async create_checkpoint({ checkpoint_id, database_name, pool_database, schema_name, kind }) {
    const cleanCheckpoint = cleanIdent(checkpoint_id);
    // The agent runs as root (no sudo needed for its own filesystem ops),
    // but pg_dump below runs as postgres and needs write access to actually
    // create files here -- postgres itself can't mkdir under /var/backups,
    // it doesn't own that parent directory.
    await run("mkdir", ["-p", CHECKPOINT_DIR]);
    await run("chown", ["-R", "postgres:postgres", "/var/backups/stashi"]);
    const filePath = `${CHECKPOINT_DIR}/${cleanCheckpoint}.dump`;

    // zstd:3 standardized across every dump this agent produces (confirmed
    // this PG17 build has libzstd and accepts --compress=zstd:3 before
    // relying on it). Never re-compress on top of this before the B2 upload
    // below -- it's already compressed.
    if (pool_database && schema_name) {
      const cleanDb = cleanIdent(pool_database);
      const cleanSchema = cleanIdent(schema_name);
      await runAsPostgres("pg_dump", ["-Fc", "--compress=zstd:3", "-n", cleanSchema, "-f", filePath, cleanDb]);
    } else {
      const cleanDb = cleanIdent(database_name);
      await runAsPostgres("pg_dump", ["-Fc", "--compress=zstd:3", "-f", filePath, cleanDb]);
    }

    await run("sudo", ["chmod", "600", filePath]);
    const stats = fs.statSync(filePath);

    let offNode = false;
    const r2Endpoint = process.env.R2_ENDPOINT_URL;
    const r2Bucket = process.env.R2_BUCKET;
    if (kind === "backup" && r2Endpoint && r2Bucket) {
      try {
        await run("aws", [
          "--endpoint-url",
          r2Endpoint,
          "s3",
          "cp",
          filePath,
          `s3://${r2Bucket}/${cleanCheckpoint}.dump`,
        ]);
        offNode = true;
      } catch (err) {
        // The local snapshot is still real and restorable -- don't fail the
        // whole job over an off-node upload hiccup, just report it wasn't
        // copied off-node this time.
        console.error(`[Backup off-node upload failed]: ${err.message}`);
      }
    }

    return { status: "ready", file_path: filePath, size_bytes: stats.size, off_node: offNode };
  },

  // 9. Restore a checkpoint — wipes current state and replaces it with the
  // snapshot. This is a rollback, not a merge: the point is an agent (or a
  // human) can undo a bad migration in one call.
  async restore_checkpoint({ checkpoint_id, database_name, pool_database, schema_name, role_name }) {
    const cleanCheckpoint = cleanIdent(checkpoint_id);
    const filePath = `${CHECKPOINT_DIR}/${cleanCheckpoint}.dump`;
    if (!fs.existsSync(filePath)) throw new Error(`checkpoint file not found: ${filePath}`);
    const cleanRole = cleanIdent(role_name);

    if (pool_database && schema_name) {
      const cleanDb = cleanIdent(pool_database);
      const cleanSchema = cleanIdent(schema_name);
      await runPsql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = '${cleanRole}';`);
      await runPsql(`DROP SCHEMA IF EXISTS "${cleanSchema}" CASCADE;`, ["-d", cleanDb]);
      await runPsql(`CREATE SCHEMA "${cleanSchema}" AUTHORIZATION "${cleanRole}";`, ["-d", cleanDb]);
      await runAsPostgres("pg_restore", ["-d", cleanDb, filePath]);
    } else {
      const cleanDb = cleanIdent(database_name);
      await runPsql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${cleanDb}';`);
      await runPsql(`DROP DATABASE IF EXISTS "${cleanDb}";`);
      await runPsql(`CREATE DATABASE "${cleanDb}" WITH OWNER = "${cleanRole}";`);
      await runPsql(`REVOKE ALL ON DATABASE "${cleanDb}" FROM PUBLIC;`);
      await runPsql(`GRANT ALL ON DATABASE "${cleanDb}" TO "${cleanRole}";`);
      await runAsPostgres("pg_restore", ["-d", cleanDb, filePath]);
    }

    return { status: "restored" };
  },
};

// Periodic Telemetry Collector
async function collectAndSendMetrics() {
  try {
    const loadAvg = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryPct = Math.round(((totalMem - freeMem) / totalMem) * 100);
    const cpuPct = Math.min(100, Math.round(loadAvg[0] * 100));

    const dbSizeQuery =
      "SELECT datname, pg_database_size(datname) as size_bytes FROM pg_database WHERE datistemplate = false;";
    let databases = [];
    try {
      const dbSizeRaw = await runPsql(dbSizeQuery);
      databases = dbSizeRaw
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [name, size] = line.split("|");
          return { name, sizeBytes: parseInt(size, 10) || 0 };
        });
    } catch (e) {
      // psql might be in mock mode during local dev
    }

    const payload = {
      nodeId: NODE_ID,
      region: REGION,
      cpuPct,
      memoryPct,
      diskPct: 24,
      databaseCount: databases.length || 1,
      databases,
      timestamp: new Date().toISOString(),
    };

    await postControlPlane("/api/agent/telemetry", payload);
  } catch (err) {
    console.error(`[Metrics Error]: ${err.message}`);
  }
}

// Main Polling Loop
async function pollJobs() {
  try {
    const res = await postControlPlane("/api/agent/jobs", { nodeId: NODE_ID });
    if (res.job) {
      const { id, type, payload } = res.job;
      console.log(`[Agent] Received job #${id} of type: ${type}`);

      const handler = JobHandlers[type];
      if (handler) {
        try {
          const result = await handler(payload);
          await postControlPlane("/api/agent/jobs/complete", { jobId: id, status: "completed", result });
        } catch (jobErr) {
          console.error(`[Job #${id} Failed]:`, jobErr);
          await postControlPlane("/api/agent/jobs/complete", { jobId: id, status: "failed", error: jobErr.message });
        }
      } else {
        console.warn(`[Agent] Unknown job type: ${type}`);
      }
    }
  } catch (err) {
    // Control plane unreachable
  } finally {
    setTimeout(pollJobs, POLL_INTERVAL);
  }
}

// TTL Sweep — finds and deletes databases past their expiry. The control
// plane decides who's expired (it owns that data); this just pings it on a
// schedule, since Render has no built-in cron for the Next.js app to hang
// one off of.
const TTL_SWEEP_INTERVAL = parseInt(process.env.STASHI_TTL_SWEEP_INTERVAL_SEC || "300", 10) * 1000;
async function sweepExpiredDatabases() {
  try {
    const res = await postControlPlane("/api/agent/ttl-sweep", { nodeId: NODE_ID });
    if (res.reaped?.length) {
      console.log(`[TTL Sweep] Reaped ${res.reaped.length} expired database(s):`, res.reaped.map((r) => r.name).join(", "));
    }
  } catch (err) {
    console.error(`[TTL Sweep Error]: ${err.message}`);
  }
}

console.log(`[Stashi Agent] Started for node: ${NODE_ID} (Region: ${REGION})`);
pollJobs();
setInterval(collectAndSendMetrics, METRICS_INTERVAL);
collectAndSendMetrics();
setInterval(sweepExpiredDatabases, TTL_SWEEP_INTERVAL);
sweepExpiredDatabases();
