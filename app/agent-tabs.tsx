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
      "args": ["-y", "@stashi/mcp-server"],
      "env": {
        "STASHI_API_KEY": "st_live_9f8a2bc4e107"
      }
    }
  }
}`,
    python: `from stashi import StashiAgent

# Sub-second ephemeral database for agentic scratchpad
db = StashiAgent.create_sandbox(
    name="swarm-research-memory",
    plan="dev",            # Fixed $1/mo flat — no loop overages
    ttl="24h",             # Ephemeral teardown or keep persistent
    auto_checkpoint=True   # Instant rollback if agent hallucinates
)

# Pass connection string directly to LangChain / LlamaIndex / CrewAI
agent.bind_database(db.connection_url)`,
    ts: `import { stashi } from "@stashi/sdk";
import { generateText } from "ai";

// Autonomous agent tool for database provisioning
const sandbox = await stashi.createSandbox({
  name: "eval-task-runner",
  plan: "dev", // $1/mo hard cap
  region: "us-east-nj"
});

console.log("Ready for tool calls:", sandbox.connectionUrl);`,
    rest: `curl -X POST https://api.stashi.dev/v1/databases \\
  -H "Authorization: Bearer st_live_••••••••" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "agent-db-01",
    "plan": "dev",
    "guardrails": { "hard_cap": 1.00, "allow_overages": false }
  }'`,
  };

  const copyCode = () => {
    navigator.clipboard.writeText(snippets[tab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ border: "1px solid #1e241e", background: "rgba(9, 11, 9, 0.7)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", color: "#e8ece7", marginTop: "32px", boxShadow: "0 20px 50px rgba(0, 0, 0, 0.45)" }}>
      {/* Code Header Tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e241e", background: "#0c0e0c", padding: "0 12px" }}>
        <div style={{ display: "flex", gap: "2px" }}>
          <button
            type="button"
            onClick={() => setTab("mcp")}
            style={{
              padding: "11px 14px",
              border: 0,
              borderBottom: tab === "mcp" ? "2px solid #34d399" : "2px solid transparent",
              background: "transparent",
              color: tab === "mcp" ? "#f5f6f4" : "#798378",
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
              borderBottom: tab === "python" ? "2px solid #34d399" : "2px solid transparent",
              background: "transparent",
              color: tab === "python" ? "#f5f6f4" : "#798378",
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
              borderBottom: tab === "ts" ? "2px solid #34d399" : "2px solid transparent",
              background: "transparent",
              color: tab === "ts" ? "#f5f6f4" : "#798378",
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
              borderBottom: tab === "rest" ? "2px solid #34d399" : "2px solid transparent",
              background: "transparent",
              color: tab === "rest" ? "#f5f6f4" : "#798378",
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
            border: "1px solid #2d382d",
            background: "#151a15",
            color: "#d8e2d9",
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
          {copied ? <Check size={11} color="#34d399" /> : <Clipboard size={11} />}
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
            color: "#a4c9a8",
          }}
        >
          {snippets[tab]}
        </pre>
      </div>
    </div>
  );
}
