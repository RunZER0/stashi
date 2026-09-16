export type StashiPermission =
  | "project.read"
  | "project.update"
  | "database.read"
  | "database.write"
  | "database.admin"
  | "api_key.create"
  | "api_key.read"
  | "api_key.revoke"
  | "oauth_client.create"
  | "oauth_client.read"
  | "oauth_client.update"
  | "oauth_client.delete"
  | "member.read"
  | "member.invite"
  | "member.update"
  | "member.remove";

export type StashiRole = "owner" | "admin" | "member" | "viewer";

export const ROLE_PERMISSIONS: Record<StashiRole, StashiPermission[]> = {
  owner: [
    "project.read",
    "project.update",
    "database.read",
    "database.write",
    "database.admin",
    "api_key.create",
    "api_key.read",
    "api_key.revoke",
    "oauth_client.create",
    "oauth_client.read",
    "oauth_client.update",
    "oauth_client.delete",
    "member.read",
    "member.invite",
    "member.update",
    "member.remove",
  ],
  admin: [
    "project.read",
    "project.update",
    "database.read",
    "database.write",
    "database.admin",
    "api_key.create",
    "api_key.read",
    "api_key.revoke",
    "oauth_client.create",
    "oauth_client.read",
    "oauth_client.update",
    "oauth_client.delete",
    "member.read",
    "member.invite",
    "member.update",
  ],
  member: [
    "project.read",
    "database.read",
    "database.write",
    "api_key.create",
    "api_key.read",
    "oauth_client.read",
    "member.read",
  ],
  viewer: [
    "project.read",
    "database.read",
    "api_key.read",
    "oauth_client.read",
    "member.read",
  ],
};

export function hasPermission(role: StashiRole, permission: StashiPermission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return Boolean(permissions && permissions.includes(permission));
}
