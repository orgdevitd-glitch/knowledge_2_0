import "server-only";

export type AdminRole = "admin";

export type AdminPrincipal = {
  uid: string;
  email: string;
  displayName: string | null;
  role: AdminRole;
  sessionIssuedAt: string;
};

export type SafeAdminPrincipalView = {
  email: string;
  displayName: string | null;
  role: AdminRole;
};

export function toSafeAdminPrincipalView(
  principal: AdminPrincipal,
): SafeAdminPrincipalView {
  return {
    email: principal.email,
    displayName: principal.displayName,
    role: principal.role,
  };
}
