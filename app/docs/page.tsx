import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Docs",
  description: "MCP setup and API examples for connecting agents and apps to Stashi.",
};

const codeBlockStyle: React.CSSProperties = {
  background: "#060607",
  color: "#e9e9ee",
  padding: "16px",
  border: "1px solid #1e1e24",
  fontSize: "12px",
  lineHeight: 1.6,
  overflowX: "auto",
  fontFamily: '"SFMono-Regular", Consolas, monospace',
  whiteSpace: "pre",
};

export default function DocsPage() {
  return (
    <main className="mk-shell">
      <SiteHeader />
      <section className="mk-wrap mk-legal">
        <div className="mk-legal-grid">
          <aside className="mk-legal-aside">
            Docs<br />
            <br />
            <a href="#mcp">MCP setup</a><br />
            <a href="#query">Running a query</a><br />
            <a href="#checkpoints">Checkpoints &amp; rollback</a><br />
            <a href="#keys">Scoped agent keys</a><br />
          </aside>
          <article className="mk-legal-body">
            <h1>Docs</h1>
            <p>
              Everything here talks to the same API your own console uses — nothing agent-only, nothing
              hidden. Every call is scoped to one database and shows up in that database's activity log.
            </p>

            <h2 id="mcp">MCP setup</h2>
            <p>
              Point Claude Desktop, Cursor, or any MCP-compatible client at your database. Get the exact
              config (with your real API key already filled in) from your console&rsquo;s Agent &amp; MCP tab —
              this is the shape of it:
            </p>
            <pre style={codeBlockStyle}>{`{
  "mcpServers": {
    "stashi": {
      "command": "npx",
      "args": ["-y", "@stashidb/mcp-server"],
      "env": {
        "STASHI_API_KEY": "st_live_...",
        "STASHI_DATABASE_ID": "DB_...",
        "STASHI_API_URL": "https://www.mystashi.online"
      }
    }
  }
}`}</pre>
            <p>
              Nine tools ship with it: <code>list_tables</code>, <code>describe_table</code>,{" "}
              <code>run_query</code>, <code>create_checkpoint</code>, <code>rollback_last_checkpoint</code>,{" "}
              <code>create_branch</code>, <code>create_agent_key</code>, <code>store_memory</code>, and{" "}
              <code>search_memory</code>.
            </p>

            <h2 id="query">Running a query without MCP</h2>
            <p>
              No SDK to install — the same API key works over plain HTTP. This is exactly what the MCP
              server calls under the hood.
            </p>
            <pre style={codeBlockStyle}>{`curl -X POST https://www.mystashi.online/api/databases/DB_xxx/query \\
  -H "Authorization: Bearer st_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"sql": "select id from orders where status = '"'"'pending'"'"' limit 50"}'`}</pre>
            <pre style={codeBlockStyle}>{`# Python — plain requests, no SDK
import requests

resp = requests.post(
    "https://www.mystashi.online/api/databases/DB_xxx/query",
    headers={"Authorization": f"Bearer {STASHI_API_KEY}"},
    json={"sql": "select id from orders where status='pending' limit 50"},
)
print(resp.json()["rows"])`}</pre>
            <pre style={codeBlockStyle}>{`// TypeScript / JavaScript — plain fetch
const res = await fetch(
  \`https://www.mystashi.online/api/databases/\${databaseId}/query\`,
  {
    method: "POST",
    headers: { Authorization: \`Bearer \${process.env.STASHI_API_KEY}\` },
    body: JSON.stringify({ sql: "select 1" }),
  }
);
const { rows } = await res.json();`}</pre>

            <h2 id="checkpoints">Checkpoints &amp; rollback</h2>
            <p>
              Any statement that looks destructive — schema changes, <code>TRUNCATE</code>, an unfiltered{" "}
              <code>DELETE</code> or <code>UPDATE</code> — triggers an automatic checkpoint first, and the
              statement waits for it to finish before running. You can also save one on demand:
            </p>
            <pre style={codeBlockStyle}>{`curl -X POST https://www.mystashi.online/api/databases/DB_xxx/checkpoints \\
  -H "Authorization: Bearer st_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"label": "before pricing migration"}'

# and to undo the most recent one:
curl -X POST https://www.mystashi.online/api/databases/DB_xxx/checkpoints/CP_ID/restore \\
  -H "Authorization: Bearer st_live_..."`}</pre>

            <h2 id="keys">Scoped agent keys</h2>
            <p>
              A full-access key can mint additional keys for subagents — read-only by default, each one
              revocable on its own and labeled separately in the activity log.
            </p>
            <pre style={codeBlockStyle}>{`curl -X POST https://www.mystashi.online/api/databases/DB_xxx/keys \\
  -H "Authorization: Bearer st_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"label": "research-subagent", "scope": "readonly"}'`}</pre>

            <p style={{ marginTop: "40px" }}>
              Questions this page doesn&rsquo;t answer: <Link href="/about">contact us</Link>.
            </p>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
