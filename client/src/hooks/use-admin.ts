import { useQuery } from "@tanstack/react-query";

interface AdminCheckResponse {
  isAdmin: boolean;
}

async function fetchAdminStatus(): Promise<boolean> {
  const response = await fetch("/api/admin/check", {
    credentials: "include",
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
