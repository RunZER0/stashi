// Lightweight, honest heuristics over raw SQL text -- not a real parser.
// Good enough to drive two things that matter more than being airtight:
// blocking a scoped read-only key from writing, and deciding whether a
// statement is destructive enough to deserve an automatic checkpoint first.
// A sufficiently adversarial query could evade either check; neither is a
// security boundary on its own (the database role's own grants are), and
// both are documented here rather than pretended to be bulletproof.

const stripComments = (sql: string) =>
  sql.replace(/--.*$/gm, " ").replace(/\/\*[\s\S]*?\*\//g, " ");

const WRITE_KEYWORDS =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|MERGE|COPY|VACUUM|REINDEX|REFRESH)\b/i;

const READ_ONLY_START = /^\s*(SELECT|WITH|EXPLAIN|SHOW|TABLE)\b/i;

// Deliberately conservative: a read-only key may only run something that
// both looks like a plain read and contains no write keyword anywhere --
// catching the `WITH x AS (DELETE ...) SELECT ...` case a naive "starts
// with SELECT" check would miss.
export function isReadOnlyStatement(sql: string): boolean {
  const clean = stripComments(sql);
  return READ_ONLY_START.test(clean) && !WRITE_KEYWORDS.test(clean);
}

export type DestructiveReason =
  | "ddl"
  | "truncate"
  | "delete_without_where"
  | "update_without_where"
  | null;

// Decides whether a statement is dangerous enough to auto-checkpoint before
// running. DDL and TRUNCATE always qualify. DELETE/UPDATE only qualify when
// there's no WHERE clause at all in the statement text -- a real WHERE
// quoted inside a string literal could produce a false negative here (skip
// the checkpoint when one would have been warranted); there is no false
// positive direction that matters, since an unnecessary checkpoint is just
// a few wasted seconds, not a safety problem.
export function classifyDestructive(sql: string): DestructiveReason {
  const clean = stripComments(sql).trim();
  if (/^(DROP|ALTER|CREATE)\b/i.test(clean)) return "ddl";
  if (/^TRUNCATE\b/i.test(clean)) return "truncate";
  if (/^DELETE\b/i.test(clean) && !/\bWHERE\b/i.test(clean)) return "delete_without_where";
  if (/^UPDATE\b/i.test(clean) && !/\bWHERE\b/i.test(clean)) return "update_without_where";
  return null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array(n + 1)
    .fill(0)
    .map((_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

// Closest match by edit distance, capped so wildly different names don't
// produce a misleading "did you mean" suggestion.
export function closestMatch(target: string, candidates: string[]): string | null {
  if (!target || candidates.length === 0) return null;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const candidate of candidates) {
    const dist = levenshtein(target.toLowerCase(), candidate.toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  const maxAllowed = Math.max(2, Math.ceil(target.length * 0.4));
  return best && bestDist <= maxAllowed ? best : null;
}
