import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { logAuditEvent } from "./audit";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "169.254.169.254", // Cloud instance metadata
  "metadata.google.internal",
]);

function isPrivateIp(ip: string): boolean {
  // RFC 1918
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("127.")) return true;
  if (ip.startsWith("169.254.")) return true;
  const match172 = ip.match(/^172\.(\d+)\./);
  if (match172) {
    const octet = parseInt(match172[1], 10);
    if (octet >= 16 && octet <= 31) return true;
  }
  return false;
}

export function validateClientMetadataUrl(urlString: string, allowLocalhostForTesting = false): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(urlString);

    if (parsed.protocol !== "https:" && !(allowLocalhostForTesting && parsed.protocol === "http:")) {
      return { valid: false, error: "Client ID metadata URL must use HTTPS" };
    }

    const rawHostname = parsed.hostname.toLowerCase();
    const hostname = rawHostname.replace(/^\[|\]$/g, "");
    if (!allowLocalhostForTesting) {
      if (
        BLOCKED_HOSTS.has(hostname) ||
        isPrivateIp(hostname) ||
        hostname === "::1" ||
        hostname === "0:0:0:0:0:0:0:1" ||
        hostname.startsWith("fe80:") ||
        hostname.startsWith("fc00:") ||
        hostname.startsWith("fd00:")
      ) {
        return { valid: false, error: "Forbidden host or private IP address" };
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid client metadata URL" };
  }
}

/**
 * Secure transport for CIMD metadata documents.
 * Protects against SSRF, loopback, private RFC1918, and metadata abuse.
 */
export async function secureFetchClientMetadataResource(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const urlString = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const allowLocal = process.env.NODE_ENV !== "production" || process.env.AUTH_ALLOW_LOCAL_CIMD === "true";
  const validation = validateClientMetadataUrl(urlString, allowLocal);

  if (!validation.valid) {
    await logAuditEvent({
      event: "security.invalid_resource",
      outcome: "blocked",
      details: { url: urlString, error: validation.error, reason: "CIMD SSRF validation failure" },
    });
    throw new Error(`CIMD metadata fetch blocked: ${validation.error}`);
  }

  try {
    return await fetchClientMetadataResource(input as string, init);
  } catch (err) {
    await logAuditEvent({
      event: "security.invalid_resource",
      outcome: "failure",
      details: { url: urlString, error: String(err) },
    });
    throw err;
  }
}
