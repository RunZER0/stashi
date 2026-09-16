# Use Stashi as your OAuth 2.1 / OIDC Provider

Stashi Auth (`https://auth.mystashi.online`) operates as a standards-compliant OAuth 2.1 and OpenID Connect (OIDC) identity and authorization server.

## Endpoints and Discovery

* **Issuer**: `https://auth.mystashi.online`
* **OIDC Discovery**: `https://auth.mystashi.online/.well-known/openid-configuration`
* **OAuth 2.1 Discovery**: `https://auth.mystashi.online/.well-known/oauth-authorization-server`
* **JWKS**: `https://auth.mystashi.online/.well-known/jwks.json`
* **Authorization**: `https://auth.mystashi.online/api/auth/oauth2/authorize`
* **Token Exchange & Refresh**: `https://auth.mystashi.online/api/auth/oauth2/token`
* **User Profile & Claims (UserInfo)**: `https://auth.mystashi.online/api/auth/oauth2/userinfo`
* **Token Introspection**: `https://auth.mystashi.online/api/auth/oauth2/introspect`
* **Token Revocation**: `https://auth.mystashi.online/api/auth/oauth2/revoke`

---

## 1. Register an Application

In the Stashi Console (**Account Settings → OAuth Applications**) or via API (`POST /api/oauth/clients`):

1. **Application Type**:
   * **Public**: For SPAs, mobile apps, and CLI tools. Token endpoint auth method is `none`. **PKCE (`S256`) is mandatory**.
   * **Confidential**: For server-side applications capable of securely maintaining a secret. A secret is generated and shown once upon creation.
2. **Redirect URIs**: Specify exact URIs (e.g. `https://my-app.com/callback` or loopback `http://127.0.0.1:8080/callback`). Wildcard URIs are prohibited.
3. **Note your Client ID** and client secret (for confidential clients).

---

## 2. Authorization Code Flow with PKCE (`S256`)

All public clients must use Proof Key for Code Exchange (PKCE) with SHA-256.

### Generate Code Verifier and Code Challenge

```ts
import { createHash, randomBytes } from "node:crypto";

const codeVerifier = randomBytes(32).toString("base64url");
const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
const state = randomBytes(16).toString("base64url");
```

### Direct the User to Authorize

```text
https://auth.mystashi.online/api/auth/oauth2/authorize
  ?response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=https://my-app.com/callback
  &scope=openid profile email offline_access emerald:search emerald:read
  &resource=https://emerald.ynai.co.ke/mcp
  &code_challenge=CODE_CHALLENGE
  &code_challenge_method=S256
  &state=STATE
```

---

## 3. Exchange Code for Tokens

Upon redirect to your callback URI with `?code=...&state=...`:

```bash
curl -X POST https://auth.mystashi.online/api/auth/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "code=AUTHORIZATION_CODE" \
  -d "redirect_uri=https://my-app.com/callback" \
  -d "code_verifier=CODE_VERIFIER"
```

Response:
```json
{
  "access_token": "eyJhbGciOiJFZERTQ...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_token": "stashi_rt_...",
  "id_token": "eyJhbGciOiJFZERTQ...",
  "scope": "openid profile email offline_access emerald:search emerald:read"
}
```

---

## 4. Refreshing Access Tokens

Refresh tokens automatically rotate on each use:

```bash
curl -X POST https://auth.mystashi.online/api/auth/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "refresh_token=YOUR_REFRESH_TOKEN"
```

---

## 5. Revoking Tokens

```bash
curl -X POST https://auth.mystashi.online/api/auth/oauth2/revoke \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "token=TOKEN_TO_REVOKE"
```
