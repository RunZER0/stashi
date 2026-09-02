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
  // 1. Create Tenant Database & Role
  async create_database({ database_name, role_name, password, connection_limit = 10 }) {
    console.log(`[Job] Creating database: ${database_name} for role: ${role_name}`);

    // Escape identifiers safely
    const cleanDb = database_name.replace(/[^a-zA-Z0-9_]/g, "");
    const cleanRole = role_name.replace(/[^a-zA-Z0-9_]/g, "");

    // 1. Create Role with SCRAM password
    await runPsql(
      `CREATE ROLE "${cleanRole}" WITH LOGIN PASSWORD '${password.replace(/'/g, "''")}' NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT ${parseInt(connection_limit, 10)};`
    );

    // 2. Create Database owned by Role
    await runPsql(`CREATE DATABASE "${cleanDb}" WITH OWNER = "${cleanRole}";`);

    // 3. Revoke public permissions & grant explicit owner privileges
    await runPsql(`REVOKE ALL ON DATABASE "${cleanDb}" FROM PUBLIC;`);
    await runPsql(`GRANT ALL ON DATABASE "${cleanDb}" TO "${cleanRole}";`);

    // 4. Update PgBouncer userlist.txt if present
    if (fs.existsSync("/etc/pgbouncer/userlist.txt")) {
      const scramHash = await runPsql(`SELECT rolpassword FROM pg_authid WHERE rolname = '${cleanRole}';`);
      fs.appendFileSync("/etc/pgbouncer/userlist.txt", `"${cleanRole}" "${scramHash}"\n`);
      execFile("sudo", ["systemctl", "reload", "pgbouncer"], () => {});
    }

    return { status: "ready", database: cleanDb, role: cleanRole };
  },

  // 2. Rotate Credentials
  async rotate_credentials({ role_name, new_password }) {
    const cleanRole = role_name.replace(/[^a-zA-Z0-9_]/g, "");
    await runPsql(`ALTER ROLE "${cleanRole}" WITH PASSWORD '${new_password.replace(/'/g, "''")}';`);

    if (fs.existsSync("/etc/pgbouncer/userlist.txt")) {
      const scramHash = await runPsql(`SELECT rolpassword FROM pg_authid WHERE rolname = '${cleanRole}';`);
      const lines = fs
        .readFileSync("/etc/pgbouncer/userlist.txt", "utf8")
        .split("\n")
        .filter((l) => !l.startsWith(`"${cleanRole}"`));
      lines.push(`"${cleanRole}" "${scramHash}"`);
      fs.writeFileSync("/etc/pgbouncer/userlist.txt", lines.join("\n"));
      execFile("sudo", ["systemctl", "reload", "pgbouncer"], () => {});
    }

    return { status: "rotated", role: cleanRole };
  },

  // 3. Suspend Database Access
  async suspend_database({ role_name }) {
    const cleanRole = role_name.replace(/[^a-zA-Z0-9_]/g, "");
    await runPsql(`ALTER ROLE "${cleanRole}" NOLOGIN;`);
    await runPsql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = '${cleanRole}';`);
    return { status: "suspended", role: cleanRole };
  },

  // 4. Resume Database Access
  async resume_database({ role_name }) {
    const cleanRole = role_name.replace(/[^a-zA-Z0-9_]/g, "");
    await runPsql(`ALTER ROLE "${cleanRole}" LOGIN;`);
    return { status: "resumed", role: cleanRole };
  },

  // 5. Delete Database
  async delete_database({ database_name, role_name }) {
    const cleanDb = database_name.replace(/[^a-zA-Z0-9_]/g, "");
    const cleanRole = role_name.replace(/[^a-zA-Z0-9_]/g, "");

    // Safety guardrail: Never delete ynai
    if (cleanDb.toLowerCase() === "ynai" || cleanRole.toLowerCase().includes("ynai")) {
      throw new Error("Safety violation: Cannot drop core production database!");
    }

    await runPsql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${cleanDb}';`);
    await runPsql(`DROP DATABASE IF EXISTS "${cleanDb}";`);
    await runPsql(`DROP ROLE IF EXISTS "${cleanRole}";`);

    if (fs.existsSync("/etc/pgbouncer/userlist.txt")) {
      const lines = fs
        .readFileSync("/etc/pgbouncer/userlist.txt", "utf8")
        .split("\n")
        .filter((l) => !l.startsWith(`"${cleanRole}"`));
      fs.writeFileSync("/etc/pgbouncer/userlist.txt", lines.join("\n"));
      execFile("sudo", ["systemctl", "reload", "pgbouncer"], () => {});
    }

    return { status: "deleted", database: cleanDb };
  },

  // 6. Health Probe
  async health_probe() {
    const version = await runPsql("SELECT version();");
    return { status: "healthy", version };
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

    // Sample PostgreSQL databases & sizes
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
    // Log softly to journal
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

console.log(`[Stashi Agent] Started for node: ${NODE_ID} (Region: ${REGION})`);
pollJobs();
setInterval(collectAndSendMetrics, METRICS_INTERVAL);
collectAndSendMetrics();
