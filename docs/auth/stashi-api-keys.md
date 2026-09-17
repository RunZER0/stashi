# Stashi API Keys

Stashi provides secure API keys for automated scripts, CLI commands, background daemons, and non-interactive MCP clients.

## Key Properties

1. **Cryptographic Entropy**: Generated using 24 bytes of cryptographically secure random bytes.
2. **Safe Prefix**: Identifiable prefix `stashi_live_...`.
3. **Hashed at Rest**: Stored as SHA-256 hashes. Plaintext keys are shown only once at creation and never logged or displayed again.
4. **Header Format**: Always send API keys using the `Authorization` header:
   ```text
   Authorization: Bearer stashi_live_...
   ```
   Passing API keys in URL query strings is insecure and deprecated.
5. **Scoped Permissions**: Keys can be minted with `full` or `readonly` scopes.
6. **Project & Database Scoping**: Keys can be scoped to a single database or across your entire account.

---

## Creating an API Key

In the Stashi Console (**Account Settings → Account-Wide MCP**) or via API:

```bash
curl -X POST https://mystashi.online/api/account/keys \
  -H "Authorization: Bearer <YOUR_SESSION_OR_FULL_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "backup-worker",
    "scope": "readonly"
  }'
```

Response:
```json
{
  "key": {
    "id": "ack_8a91c7...",
    "label": "backup-worker",
    "scope": "readonly",
    "apiKey": "stashi_live_1a2b3c4d5e6f...",
    "createdAt": "2026-09-16T12:00:00.000Z"
  }
}
```

---

## Revoking an API Key

```bash
curl -X DELETE https://mystashi.online/api/account/keys/KEY_ID \
  -H "Authorization: Bearer <SESSION_OR_PARENT_KEY>"
```
