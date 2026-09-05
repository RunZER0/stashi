"use client";

import { useState } from "react";
import { Check, Clipboard } from "lucide-react";

export function AgentTabs() {
  const [tab, setTab] = useState<"mcp" | "python" | "ts" | "rest">("mcp");
  const [copied, setCopied] = useState(false);

  const snippets = {
    mcp: `{
  "mcpServers": {
    "stashi": {
      "command": "npx",
      "args": ["-y", "@stashidb/mcp-server"],
      "env": {
        "STASHI_API_KEY": "st_live_9f8a2bc4e107",
        "STASHI_DATABASE_ID": "DB_xxx"
      }
    }
  }
}`,
    python: `import requests

# No SDK to install — the API key that powers MCP tool calls works
# directly over plain HTTP, on the same audited path a human's queries take.
BASE = "https://stashi.onrender.com/api/databases"
resp = requests.post(
    f"{BASE}/{DATABASE_ID}/query",
    headers={"Authorization": f"Bearer {STASHI_API_KEY}"},
    json={"sql": "select id from orders where status='pending' limit 50"},
)
print(resp.json()["rows"])`,
    ts: `// No SDK — plain fetch against the same endpoint the MCP server calls.
const res = await fetch(
  \`https://stashi.onrender.com/api/databases/\${databaseId}/query\`,
  {
    method: "POST",
    headers: { Authorization: \`Bearer \${process.env.STASHI_API_KEY}\` },
    body: JSON.stringify({ sql: "select 1" }),
  }
);
const { rows } = await res.json();`,
    rest: `curl -X POST https://stashi.onrender.com/api/databases/DB_xxx/query \\
  -H "Authorization: Bearer st_live_••••••••" \\
  -H "Content-Type: application/json" \\
  -d '{"sql": "select id from orders where status = '"'"'pending'"'"' limit 50"}'`,
  };

  const copyCode = () => {
    navigator.clipboard.writeText(snippets[tab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ border: "1px solid #1e1e24", background: "rgba(9, 9, 11, 0.7)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", color: "#e8e7ec", marginTop: "32px", boxShadow: "0 20px 50px rgba(0, 0, 0, 0.45)" }}>
      {/* Code Header Tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e1e24", background: "#0c0c0e", padding: "0 12px" }}>
        <div style={{ display: "flex", gap: "2px" }}>
          <button
            type="button"
            onClick={() => setTab("mcp")}
            style={{
              padding: "11px 14px",
              border: 0,
              borderBottom: tab === "mcp" ? "2px solid #1478fc" : "2px solid transparent",
              background: "transparent",
              color: tab === "mcp" ? "#f5f4f6" : "#797883",
              fontSize: "11px",
              fontWeight: 700,
              fontFamily: '"SFMono-Regular", Consolas, monospace',
              cursor: "pointer",
              letterSpacing: ".05em",
              transition: "all .15s ease",
            }}
          >
            MCP Config (Claude / Cursor / Antigravity)
          </button>
          <button
            type="button"
            onClick={() => setTab("python")}
            style={{
              padding: "11px 14px",
              border: 0,
              borderBottom: tab === "python" ? "2px solid #1478fc" : "2px solid transparent",
              background: "transparent",
              color: tab === "python" ? "#f5f4f6" : "#797883",
              fontSize: "11px",
              fontWeight: 700,
              fontFamily: '"SFMono-Regular", Consolas, monospace',
              cursor: "pointer",
              letterSpacing: ".05em",
              transition: "all .15s ease",
            }}
          >
            Python (LangChain / LlamaIndex)
          </button>
          <button
            type="button"
            onClick={() => setTab("ts")}
            style={{
              padding: "11px 14px",
              border: 0,
              borderBottom: tab === "ts" ? "2px solid #1478fc" : "2px solid transparent",
              background: "transparent",
              color: tab === "ts" ? "#f5f4f6" : "#797883",
              fontSize: "11px",
              fontWeight: 700,
              fontFamily: '"SFMono-Regular", Consolas, monospace',
              cursor: "pointer",
              letterSpacing: ".05em",
              transition: "all .15s ease",
            }}
          >
            TypeScript / AI SDK
          </button>
          <button
            type="button"
            onClick={() => setTab("rest")}
            style={{
              padding: "11px 14px",
              border: 0,
              borderBottom: tab === "rest" ? "2px solid #1478fc" : "2px solid transparent",
              background: "transparent",
              color: tab === "rest" ? "#f5f4f6" : "#797883",
              fontSize: "11px",
              fontWeight: 700,
              fontFamily: '"SFMono-Regular", Consolas, monospace',
              cursor: "pointer",
              letterSpacing: ".05em",
              transition: "all .15s ease",
            }}
          >
            cURL / REST API
          </button>
        </div>

        <button
          type="button"
          onClick={copyCode}
          style={{
            border: "1px solid #2d2d38",
            background: "#15151a",
            color: "#d8d9e2",
            fontSize: "10px",
            padding: "5px 10px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            cursor: "pointer",
            fontFamily: '"SFMono-Regular", monospace',
            transition: "border-color .15s ease",
          }}
        >
          {copied ? <Check size={11} color="#1478fc" /> : <Clipboard size={11} />}
          {copied ? "COPIED" : "COPY CODE"}
        </button>
      </div>

      {/* Code Body */}
      <div style={{ padding: "20px 24px", overflowX: "auto" }}>
        <pre
          style={{
            margin: 0,
            fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
            fontSize: "12px",
            lineHeight: 1.6,
            color: "#a4a8c9",
          }}
        >
          {snippets[tab]}
        </pre>
      </div>
    </div>
  );
}
