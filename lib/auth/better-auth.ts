import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { cimd } from "@better-auth/cimd";
import { getPool } from "../db";
import { recordUserSeen } from "../store";
import { renderPasswordResetEmail, renderVerificationEmail, sendEmail } from "../email";
import { logAuditEvent } from "./audit";
import { secureFetchClientMetadataResource } from "./cimd-transport";
import { getAllResourceIdentifiers, getAllSupportedScopes } from "./resources";

const CANONICAL_ISSUER = process.env.BETTER_AUTH_URL || "https://auth.mystashi.online";
const authSecret = process.env.BETTER_AUTH_SECRET || "stashi-development-secret-must-be-configured-in-prod-123456";

export const auth = betterAuth({
  baseURL: CANONICAL_ISSUER,
  secret: authSecret,
  database: getPool(),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.NODE_ENV === "production" && process.env.AUTH_REQUIRE_EMAIL_VERIFY === "true",
    async sendResetPassword({ user, url }: { user: { email: string }; url: string }) {
      const { subject, html, text } = renderPasswordResetEmail(url);
      await sendEmail({ to: user.email, subject, html, text });
      await logAuditEvent({
        event: "user.password.changed",
        outcome: "success",
        userEmail: user.email,
        details: { action: "reset_password_email_sent" },
      });
    },
    async sendVerificationEmail({ user, url }: { user: { email: string }; url: string }) {
      const { subject, html, text } = renderVerificationEmail(url);
      await sendEmail({ to: user.email, subject, html, text });
      await logAuditEvent({
        event: "user.email.verified",
        outcome: "success",
        userEmail: user.email,
        details: { action: "verification_email_sent" },
      });
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || process.env.AUTH_GITHUB_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || process.env.AUTH_GITHUB_SECRET || "",
      enabled: Boolean(process.env.GITHUB_CLIENT_ID || process.env.AUTH_GITHUB_ID),
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET || "",
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID),
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
    },
  },
  plugins: [
    jwt({
      jwks: {
        jwksPath: "/jwks",
        keyPairConfig: {
          alg: "EdDSA",
        },
      },
    }),
    oauthProvider({
      loginPage: "/sign-in",
      consentPage: "/consent",
      scopes: getAllSupportedScopes(),
      resources: getAllResourceIdentifiers(),
      clientRegistrationAllowedScopes: getAllSupportedScopes(),
      clientRegistrationAllowedResources: getAllResourceIdentifiers(),
      allowDynamicClientRegistration: process.env.AUTH_ENABLE_LEGACY_DCR === "true",
      allowUnauthenticatedClientRegistration: false,
    }),
    cimd({
      fetchClientMetadataResource: secureFetchClientMetadataResource,
      metadataProfile: "mcp-2026-07-28",
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        async after(user) {
          if (user.email) {
            await recordUserSeen(user.email);
            await logAuditEvent({
              event: "user.created",
              outcome: "success",
              userId: user.id,
              userEmail: user.email,
            });
          }
        },
      },
    },
    session: {
      create: {
        async after(session) {
          if (session.userId) {
            await logAuditEvent({
              event: "user.login.success",
              outcome: "success",
              userId: session.userId,
            });
          }
        },
      },
    },
  },
});
