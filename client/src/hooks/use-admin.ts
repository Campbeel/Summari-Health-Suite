import { useQuery } from "@tanstack/react-query";

interface AdminCheckResponse {
  isAdmin: boolean;
}

async function fetchAdminStatus(): Promise<boolean> {
  const token = localStorage.getItem("auth_token");
  if (!token) return false;
  const response = await fetch("/api/admin/check", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return false;
  }

  const data: AdminCheckResponse = await response.json();
  return data.isAdmin;
}

export function useAdmin() {
  const { data: isAdmin, isLoading } = useQuery<boolean>({
    queryKey: ["/api/admin/check"],
    queryFn: fetchAdminStatus,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  return {
    isAdmin: !!isAdmin,
    isLoading,
  };
}
