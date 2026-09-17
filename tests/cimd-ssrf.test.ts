import { describe, it, expect } from "vitest";
import { validateClientMetadataUrl } from "@/lib/auth/cimd-transport";

describe("CIMD SSRF Protection", () => {
  it("allows valid public HTTPS metadata URLs", () => {
    const res = validateClientMetadataUrl("https://example.com/.well-known/oauth-client.json");
    expect(res.valid).toBe(true);
  });

  it("rejects plain HTTP metadata URLs in production", () => {
    const res = validateClientMetadataUrl("http://example.com/metadata.json", false);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("HTTPS");
  });

  it("blocks localhost and loopback IPv4/IPv6", () => {
    expect(validateClientMetadataUrl("https://localhost/client.json", false).valid).toBe(false);
    expect(validateClientMetadataUrl("https://127.0.0.1/client.json", false).valid).toBe(false);
    expect(validateClientMetadataUrl("https://[::1]/client.json", false).valid).toBe(false);
  });

  it("blocks RFC 1918 private network addresses", () => {
    expect(validateClientMetadataUrl("https://10.0.0.5/client.json", false).valid).toBe(false);
    expect(validateClientMetadataUrl("https://192.168.1.100/client.json", false).valid).toBe(false);
    expect(validateClientMetadataUrl("https://172.16.0.1/client.json", false).valid).toBe(false);
    expect(validateClientMetadataUrl("https://172.31.255.255/client.json", false).valid).toBe(false);
  });

  it("blocks cloud instance metadata IP (169.254.169.254)", () => {
    expect(validateClientMetadataUrl("https://169.254.169.254/latest/meta-data", false).valid).toBe(false);
  });

  it("rejects non-HTTP protocols (file, gopher, ftp)", () => {
    expect(validateClientMetadataUrl("file:///etc/passwd").valid).toBe(false);
    expect(validateClientMetadataUrl("ftp://ftp.example.com/client.json").valid).toBe(false);
    expect(validateClientMetadataUrl("javascript:alert(1)").valid).toBe(false);
  });
});
