import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";
import type { Patient } from "@shared/schema";

interface AuthResponse {
  user: User;
  patient: Patient;
}

async function fetchUser(): Promise<AuthResponse | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logout(): Promise<void> {
  window.location.href = "/api/logout";
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<AuthResponse | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
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
