import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Stashi Auth Management API",
      version: "1.0.0",
      description: "API for managing OAuth applications, API keys, linked identities, and user consents on Stashi.",
    },
    servers: [
      {
        url: "https://mystashi.online",
        description: "Canonical Production Authorization Server",
      },
    ],
    paths: {
      "/api/oauth/clients": {
        get: {
          summary: "List OAuth Applications",
          description: "List all OAuth 2.1 client applications owned by the authenticated developer.",
          responses: {
            "200": {
              description: "List of OAuth applications",
            },
            "401": {
              description: "Unauthenticated",
            },
          },
        },
        post: {
          summary: "Create OAuth Application",
          description: "Register a new OAuth 2.1 public or confidential client application.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "redirectUris"],
                  properties: {
                    name: { type: "string" },
                    redirectUris: { type: "array", items: { type: "string" } },
                    clientType: { type: "string", enum: ["public", "confidential"] },
                    scopes: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Application created",
            },
          },
        },
      },
      "/api/account/authorized-apps": {
        get: {
          summary: "List Authorized Applications",
          description: "List all third-party applications authorized by the current user.",
          responses: {
            "200": {
              description: "List of authorized applications and granted scopes",
            },
          },
        },
        delete: {
          summary: "Revoke Application Authorization",
          description: "Immediately invalidate all tokens and consents for a third-party application.",
          parameters: [
            {
              name: "clientId",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Application revoked",
            },
          },
        },
      },
      "/api/account/keys": {
        get: {
          summary: "List Account API Keys",
          description: "List all account-wide API keys.",
        },
        post: {
          summary: "Create Account API Key",
          description: "Create a new hashed account key.",
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
