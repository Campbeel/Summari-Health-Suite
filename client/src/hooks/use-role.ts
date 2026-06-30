import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export type UserRole = "staff" | "admin";

interface RoleResponse {
  isAdmin: boolean;
  role: UserRole | "patient" | "doctor" | "superAdmin";
  organizationId: string | null;
}

function normalizeRole(role: string | undefined | null): UserRole | null {
  if (role === "admin") return "admin";
  if (role === "staff" || role === "doctor") return "staff";
  return null;
}

async function fetchRole(): Promise<RoleResponse | null> {
  const token = localStorage.getItem("auth_token");
  if (!token) return null;
  const res = await fetch("/api/admin/check", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    localStorage.removeItem("auth_token");
    return null;
  }
  if (!res.ok) return null;
  return res.json();
}

export function useRole() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  const roleFromUser = normalizeRole(user?.role);

  const { data: roleCheck, isLoading: checkLoading } = useQuery<RoleResponse | null>({
    queryKey: ["/api/admin/check"],
    queryFn: fetchRole,
    enabled: isAuthenticated && !roleFromUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const role = roleFromUser ?? normalizeRole(roleCheck?.role);

  const isLoading =
    authLoading ||
    (isAuthenticated && !role && checkLoading);

  return {
    role,
    organizationId: user?.organizationId ?? roleCheck?.organizationId ?? null,
    isAdmin: role === "admin",
    isStaff: role === "staff",
    isLoading,
  };
}

export function homeForRole(role: UserRole | null): string {
  if (role === "admin") return "/admin/dashboard";
  if (role === "staff") return "/staff/dashboard";
  return "/login";
}
