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

  return response.json();
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
    isAuthenticated: !!data,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}

export function loginWithToken(token: string) {
  localStorage.setItem("auth_token", token);
  globalQueryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
}
