import { useQuery } from "@tanstack/react-query";

export type UserRole = "patient" | "doctor" | "admin" | "superAdmin";

interface RoleResponse {
  isAdmin: boolean;
  role: UserRole;
  organizationId: string | null;
}

async function fetchRole(): Promise<RoleResponse> {
  const token = localStorage.getItem("auth_token");
  if (!token) return { isAdmin: false, role: "patient", organizationId: null };
  const res = await fetch("/api/admin/check", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { isAdmin: false, role: "patient", organizationId: null };
  return res.json();
}

export function useRole() {
  const { data, isLoading } = useQuery<RoleResponse>({
    queryKey: ["/api/admin/check"],
    queryFn: fetchRole,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  return {
    role: (data?.role || "patient") as UserRole,
    organizationId: data?.organizationId || null,
    isAdmin: data?.role === "admin",
    isSuperAdmin: data?.role === "superAdmin",
    isDoctor: data?.role === "doctor",
    isPatient: data?.role === "patient",
    isLoading,
  };
}
