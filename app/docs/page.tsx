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
            <a href="#mcp-remote">Remote MCP (ChatGPT)</a><br />
            <a href="#mcp-account">Account-wide MCP</a><br />
            <a href="#query">Running a query</a><br />
            <a href="#dev-schema">Dev plan schemas</a><br />
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

            <h2 id="mcp-remote">Remote MCP (HTTP-based clients)</h2>
            <p>
              For remote clients and webhooks that connect over public HTTPS, Stashi provides an MCP endpoint using the Streamable HTTP transport. Two authentication options are supported:
            </p>
            <pre style={codeBlockStyle}>{`Header-based authentication:
URL:   https://www.mystashi.online/mcp
Auth:  Authorization: Bearer <your STASHI_API_KEY>

URL-based authentication (e.g. ChatGPT Developer mode):
URL:   https://www.mystashi.online/mcp/<your STASHI_API_KEY>
Auth:  None (the key in the URL serves as the credential)`}</pre>
            <p>
              In ChatGPT: Settings → Security and login → Developer mode, then Plugins → + → paste the URL and select &ldquo;No Auth.&rdquo;
              Both URLs are also available on your database&rsquo;s Agent &amp; MCP tab in the console. The endpoint automatically resolves the target database from the provided key on every call.
            </p>

            <h2 id="mcp-account">Account-wide MCP (multiple databases, one connection)</h2>
            <p>
              An account key reaches every database you own through a single connection. Generate one from your database&rsquo;s Agent &amp; MCP tab under &ldquo;Connect once, reach every database&rdquo;:
            </p>
            <pre style={codeBlockStyle}>{`URL:   https://www.mystashi.online/mcp/<your account key>
Auth:  None (the key in the URL serves as the credential)`}</pre>
            <p>
              The tool set gains a tenth tool, <code>list_databases</code> (id, name, plan, status, region for
              everything on the account), and the other nine each take a required <code>databaseId</code>{" "}
              argument instead of it being fixed to the connection. The usual pattern: call{" "}
              <code>list_databases</code> once, then pass whichever id you need on every subsequent{" "}
              <code>run_query</code>, <code>create_checkpoint</code>, etc. Same auto-checkpointing on
              destructive statements and same audit log per database — nothing pooled or shared between them,
              just addressed by id instead of baked into the URL.
            </p>
            <p>
              Account keys carry the same full/read-only scope as per-database scoped keys, and the same
              rule for who can create one: a full key minting another key isn&rsquo;t privilege escalation
              (neither can exceed the account&rsquo;s own access), so an agent holding a full account key can
              mint itself narrower keys for subagents without you in the loop. Revoking an account key cuts
              off access to every database at once — reconnecting an existing ChatGPT/Claude connector to the
              account-wide form means adding it as a new connector, not editing the old per-database one in
              place.
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

            <h2 id="dev-schema">Dev plan schema isolation</h2>
            <p>
              Dev databases use a pooled tenancy model. Multiple Dev databases share the same physical
              PostgreSQL database, but every tenant receives its own PostgreSQL role and its own schema.
              Stashi sets that schema as the role&apos;s default <code>search_path</code>, so ordinary
              unqualified SQL such as <code>CREATE TABLE users (...)</code> is created inside that tenant
              schema automatically.
            </p>
            <p>
              Applications on the Dev plan should avoid hard-coding the <code>public</code> schema in
              migrations or ORM configuration. Statements such as <code>CREATE TABLE public.users (...)</code>
              or <code>REFERENCES public.users(id)</code> bypass the tenant&apos;s assigned schema and will
              normally fail with a permission error. This is expected and is part of Stashi&apos;s isolation
              boundary.
            </p>
            <pre style={codeBlockStyle}>{`-- Portable across Stashi Dev and isolated plans
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE
);

-- Avoid on pooled Dev databases
CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE
);`}</pre>
            <p>
              Most ORMs work without changes when they emit unqualified table and type names. If your migration
              tool generates explicit <code>public.</code> qualifiers, configure it to use the connection&apos;s
              current schema or remove those qualifiers before applying migrations. Starter, Production and
              Dedicated databases use isolated databases, but schema-agnostic migrations remain the recommended
              approach because the same migration set can move between plans safely.
            </p>

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
