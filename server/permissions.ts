export type StaffRole = "admin" | "support" | "content";

export type Permission =
  | "analytics:read"
  | "audit:read"
  | "users:read"
  | "users:write"
  | "users:role"
  | "users:impersonate"
  | "payments:read"
  | "payments:write"
  | "projects:moderate"
  | "templates:read"
  | "templates:write"
  | "settings:write";

const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  admin: [
    "analytics:read", "audit:read", "users:read", "users:write", "users:role",
    "users:impersonate", "payments:read", "payments:write", "projects:moderate",
    "templates:read", "templates:write", "settings:write",
  ],
  support: [
    "analytics:read", "audit:read", "users:read", "users:write",
    "users:impersonate", "payments:read",
  ],
  content: ["templates:read", "templates:write", "analytics:read"],
};

export function isStaffRole(role: string): role is StaffRole {
  return role === "admin" || role === "support" || role === "content";
}

export function hasPermission(role: string, permission: Permission): boolean {
  if (role === "admin") return true;
  if (!isStaffRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function requireStaffRole(role: string): boolean {
  return isStaffRole(role);
}
