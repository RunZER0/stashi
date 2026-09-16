import { describe, it, expect } from "vitest";
import { generateRawApiKey, hashApiKey } from "@/lib/auth/api-keys";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { renderVerificationEmail, renderPasswordResetEmail } from "@/lib/email";

describe("API Key Hashing & Prefixes", () => {
  it("generates cryptographically strong keys with identifiable safe prefix", () => {
    const { plaintextKey, keyHash, keyPrefix } = generateRawApiKey();

    expect(plaintextKey.startsWith("stashi_live_")).toBe(true);
    expect(keyPrefix.startsWith("stashi_live_")).toBe(true);
    expect(plaintextKey.length).toBeGreaterThan(32);
    expect(keyHash).toBe(hashApiKey(plaintextKey));
  });

  it("produces deterministic SHA-256 hash", () => {
    const sampleKey = "stashi_live_test_key_123456789";
    const hash1 = hashApiKey(sampleKey);
    const hash2 = hashApiKey(sampleKey);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex length
  });
});

describe("Rate Limiting", () => {
  it("permits requests within quota and blocks when exceeded", () => {
    const testKey = `test_rate_limit_${Date.now()}`;
    const limit = 3;
    const windowSeconds = 10;

    const r1 = checkRateLimit({ key: testKey, limit, windowSeconds });
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit({ key: testKey, limit, windowSeconds });
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit({ key: testKey, limit, windowSeconds });
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    // 4th request must be blocked
    const r4 = checkRateLimit({ key: testKey, limit, windowSeconds });
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });
});

describe("Security Email Templates", () => {
  it("generates verification email containing single-use link", () => {
    const testUrl = "https://auth.mystashi.online/verify-email?token=sec_token_123";
    const email = renderVerificationEmail(testUrl);

    expect(email.subject).toContain("Verify");
    expect(email.text).toContain(testUrl);
    expect(email.html).toContain(testUrl);
  });

  it("generates password reset email with 15-minute expiration notice", () => {
    const testUrl = "https://auth.mystashi.online/reset-password?token=pwd_token_456";
    const email = renderPasswordResetEmail(testUrl);

    expect(email.subject).toContain("Reset your Stashi password");
    expect(email.text).toContain("15 minutes");
    expect(email.html).toContain(testUrl);
  });
});
