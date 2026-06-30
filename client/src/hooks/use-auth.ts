import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";
import type { Patient } from "@shared/schema";
import { queryClient as globalQueryClient } from "@/lib/queryClient";

interface AuthResponse {
  user: User;
  patient: Patient;
}

async function fetchUser(): Promise<AuthResponse | null> {
  const token = localStorage.getItem("auth_token");
  if (!token) {
    return null;
  }

  const response = await fetch("/api/auth/user", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    localStorage.removeItem("auth_token");
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data?.user?.id) {
    localStorage.removeItem("auth_token");
    return null;
  }

  return data;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<AuthResponse | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    // Revalidate when the tab regains focus. If the JWT expired while the user was away
    // (e.g. left their laptop overnight), this triggers the 401 path that clears the token.
    refetchOnWindowFocus: true,
    staleTime: 1000 * 60 * 5,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      localStorage.removeItem("auth_token");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.clear();
      window.location.href = "/";
    },
  });

  return {
    user: data?.user ?? null,
    patient: data?.patient ?? null,
    isLoading,
    isAuthenticated: !!data?.user?.id,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}

export function loginWithToken(
  token: string,
  user?: { id?: string; role?: string; organizationId?: string | null },
) {
  localStorage.setItem("auth_token", token);

  if (user?.id) {
    globalQueryClient.setQueryData(["/api/auth/user"], { user, patient: null });
  }
  if (user?.role) {
    const role = user.role === "doctor" ? "staff" : user.role;
    globalQueryClient.setQueryData(["/api/admin/check"], {
      isAdmin: role === "admin",
      role,
      organizationId: user.organizationId ?? null,
    });
  }

  globalQueryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  globalQueryClient.invalidateQueries({ queryKey: ["/api/admin/check"] });
  globalQueryClient.invalidateQueries({ queryKey: ["/api/doctors/me"] });
}
