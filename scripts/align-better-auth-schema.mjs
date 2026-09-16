import pg from "pg";
const { Pool } = pg;

const connectionString = process.env.CONTROL_PLANE_DATABASE_URL;
if (!connectionString) {
  console.error("CONTROL_PLANE_DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString, max: 2 });

async function run() {
  console.log("Aligning Better Auth schema columns...");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Make old columns nullable
    await client.query(`
      ALTER TABLE "oauthClient" ALTER COLUMN "redirectUrls" DROP NOT NULL;
      ALTER TABLE "oauthRefreshToken" ALTER COLUMN "scope" DROP NOT NULL;
      ALTER TABLE "oauthAccessToken" ALTER COLUMN "scope" DROP NOT NULL;
      ALTER TABLE "oauthConsent" ALTER COLUMN "scope" DROP NOT NULL;
      ALTER TABLE "oauthClientAssertion" ALTER COLUMN "clientId" DROP NOT NULL;
      ALTER TABLE "oauthClientAssertion" ALTER COLUMN "jti" DROP NOT NULL;
    `);

    // Add missing columns
    await client.query(`
      ALTER TABLE "jwks" ADD COLUMN IF NOT EXISTS "expiresAt" timestamptz;
      ALTER TABLE "jwks" ADD COLUMN IF NOT EXISTS "alg" text;
      ALTER TABLE "jwks" ADD COLUMN IF NOT EXISTS "crv" text;

      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "clientDiscoveryId" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "skipConsent" boolean DEFAULT false;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "enableEndSession" boolean DEFAULT false;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "subjectType" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "scopes" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "clientCredentialsScopes" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "uri" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "contacts" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "tos" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "policy" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "softwareId" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "softwareVersion" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "softwareStatement" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "redirectUris" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "postLogoutRedirectUris" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "backchannelLogoutUri" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "backchannelLogoutSessionRequired" boolean;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "tokenEndpointAuthMethod" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "applicationType" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "jwks" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "jwksUri" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "grantTypes" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "responseTypes" text;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "requirePKCE" boolean DEFAULT true;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "dpopBoundAccessTokens" boolean DEFAULT false;
      ALTER TABLE "oauthClient" ADD COLUMN IF NOT EXISTS "referenceId" text;

      ALTER TABLE "oauthResource" ADD COLUMN IF NOT EXISTS "accessTokenTtl" integer;
      ALTER TABLE "oauthResource" ADD COLUMN IF NOT EXISTS "refreshTokenTtl" integer;
      ALTER TABLE "oauthResource" ADD COLUMN IF NOT EXISTS "signingAlgorithm" text;
      ALTER TABLE "oauthResource" ADD COLUMN IF NOT EXISTS "signingKeyId" text;
      ALTER TABLE "oauthResource" ADD COLUMN IF NOT EXISTS "allowedScopes" text;
      ALTER TABLE "oauthResource" ADD COLUMN IF NOT EXISTS "customClaims" text;
      ALTER TABLE "oauthResource" ADD COLUMN IF NOT EXISTS "dpopBoundAccessTokensRequired" boolean DEFAULT false;
      ALTER TABLE "oauthResource" ADD COLUMN IF NOT EXISTS "disabled" boolean DEFAULT false;
      ALTER TABLE "oauthResource" ADD COLUMN IF NOT EXISTS "policyVersion" text;

      ALTER TABLE "oauthClientResource" ADD COLUMN IF NOT EXISTS "metadata" text;

      ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "referenceId" text;
      ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "authorizationCodeId" text;
      ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "resources" text;
      ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "requestedUserInfoClaims" text;
      ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "rotatedAt" timestamptz;
      ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "rotationReplayResponse" text;
      ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "rotationReplayExpiresAt" timestamptz;
      ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "authTime" timestamptz;
      ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "confirmation" text;
      ALTER TABLE "oauthRefreshToken" ADD COLUMN IF NOT EXISTS "scopes" text;

      ALTER TABLE "oauthAccessToken" ADD COLUMN IF NOT EXISTS "referenceId" text;
      ALTER TABLE "oauthAccessToken" ADD COLUMN IF NOT EXISTS "authorizationCodeId" text;
      ALTER TABLE "oauthAccessToken" ADD COLUMN IF NOT EXISTS "resources" text;
      ALTER TABLE "oauthAccessToken" ADD COLUMN IF NOT EXISTS "requestedUserInfoClaims" text;
      ALTER TABLE "oauthAccessToken" ADD COLUMN IF NOT EXISTS "refreshId" text;
      ALTER TABLE "oauthAccessToken" ADD COLUMN IF NOT EXISTS "confirmation" text;
      ALTER TABLE "oauthAccessToken" ADD COLUMN IF NOT EXISTS "scopes" text;

      ALTER TABLE "oauthConsent" ADD COLUMN IF NOT EXISTS "referenceId" text;
      ALTER TABLE "oauthConsent" ADD COLUMN IF NOT EXISTS "resources" text;
      ALTER TABLE "oauthConsent" ADD COLUMN IF NOT EXISTS "requestedUserInfoClaims" text;
      ALTER TABLE "oauthConsent" ADD COLUMN IF NOT EXISTS "scopes" text;
    `);

    // Sync redirectUris with redirectUrls if any exist
    await client.query(`
      UPDATE "oauthClient" SET "redirectUris" = "redirectUrls" WHERE "redirectUris" IS NULL AND "redirectUrls" IS NOT NULL;
    `);

    await client.query("COMMIT");
    console.log("SCHEMA_ALIGNED_SUCCESSFULLY");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Alignment error:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
