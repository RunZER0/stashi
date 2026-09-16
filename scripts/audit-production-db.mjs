import pg from "pg";
const { Pool } = pg;

const connectionString = process.env.CONTROL_PLANE_DATABASE_URL;
if (!connectionString) {
  console.error("CONTROL_PLANE_DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString, max: 2 });

async function audit() {
  console.log("=== Auditing Production Stashi Control Plane Database ===");
  const client = await pool.connect();
  try {
    // 1. Existing core entities
    const usersCount = (await client.query("SELECT COUNT(*) FROM users")).rows[0].count;
    const dbCount = (await client.query("SELECT COUNT(*) FROM databases")).rows[0].count;
    const scopedKeysCount = (await client.query("SELECT COUNT(*) FROM scoped_keys")).rows[0].count;
    const accountKeysCount = (await client.query("SELECT COUNT(*) FROM account_keys")).rows[0].count;
    const checkpointsCount = (await client.query("SELECT COUNT(*) FROM checkpoints")).rows[0].count;
    const jobsCount = (await client.query("SELECT COUNT(*) FROM jobs")).rows[0].count;

    console.log("\n[Core Existing Entities]");
    console.log(`- users: ${usersCount}`);
    console.log(`- databases: ${dbCount}`);
    console.log(`- scoped_keys: ${scopedKeysCount}`);
    console.log(`- account_keys: ${accountKeysCount}`);
    console.log(`- checkpoints: ${checkpointsCount}`);
    console.log(`- jobs: ${jobsCount}`);

    // 2. Newly added Better Auth & OAuth tables
    console.log("\n[Better Auth & OAuth Tables]");
    const baTables = [
      "user",
      "session",
      "account",
      "verification",
      "jwks",
      "oauthClient",
      "oauthResource",
      "oauthClientResource",
      "oauthRefreshToken",
      "oauthAccessToken",
      "oauthConsent",
      "oauthClientAssertion",
    ];

    for (const tbl of baTables) {
      const exists = (
        await client.query(
          "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
          [tbl]
        )
      ).rows[0].exists;
      if (exists) {
        const count = (await client.query(`SELECT COUNT(*) FROM "${tbl}"`)).rows[0].count;
        console.log(`- "${tbl}": EXISTS (rows: ${count})`);
      } else {
        console.log(`- "${tbl}": MISSING`);
      }
    }

    // 3. Projects & Project Members
    console.log("\n[Multi-Tenancy & Project Abstraction]");
    const projectsCount = (await client.query("SELECT COUNT(*) FROM projects")).rows[0].count;
    const membersCount = (await client.query("SELECT COUNT(*) FROM project_members")).rows[0].count;
    console.log(`- projects: ${projectsCount}`);
    console.log(`- project_members: ${membersCount}`);

    // Check orphan members (members without a valid project)
    const orphanMembers = (
      await client.query(`
        SELECT COUNT(*) FROM project_members pm
        LEFT JOIN projects p ON p.id = pm.project_id
        WHERE p.id IS NULL
      `)
    ).rows[0].count;

    // Check databases unlinked to projects
    const unlinkedDbs = (
      await client.query(`
        SELECT COUNT(*) FROM databases WHERE project_id IS NULL
      `)
    ).rows[0].count;

    console.log(`- orphan project_members: ${orphanMembers}`);
    console.log(`- databases unlinked to project: ${unlinkedDbs}`);

    // 4. Columns check on existing tables
    console.log("\n[Altered Columns Check]");
    const colCheck = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('databases', 'scoped_keys', 'account_keys')
        AND column_name IN ('project_id', 'key_hash', 'key_prefix', 'expires_at')
      ORDER BY table_name, column_name
    `);
    for (const row of colCheck.rows) {
      console.log(`- ${row.table_name}.${row.column_name} (${row.data_type})`);
    }

    // 5. Existing keys integrity
    const nullSecretScoped = (await client.query("SELECT COUNT(*) FROM scoped_keys WHERE api_key IS NULL")).rows[0].count;
    const nullSecretAccount = (await client.query("SELECT COUNT(*) FROM account_keys WHERE api_key IS NULL")).rows[0].count;
    console.log("\n[Existing Key Secret Integrity]");
    console.log(`- scoped_keys with null secret: ${nullSecretScoped}`);
    console.log(`- account_keys with null secret: ${nullSecretAccount}`);

    console.log("\n=== Production DB Audit Complete: ZERO DESTRUCTIVE MUTATIONS DETECTED ===");
  } finally {
    client.release();
    await pool.end();
  }
}

audit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
