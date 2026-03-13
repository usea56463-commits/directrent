import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { parseWithLogging } from "@/lib/zod-helper";

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: auth, isLoading } = useQuery({
    queryKey: [api.auth.check.path],
    queryFn: async () => {
      const res = await fetch(api.auth.check.path, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return { authenticated: false };
        throw new Error("Failed to check auth");
      }
      const data = await res.json();
      return parseWithLogging(api.auth.check.responses[200], data, "auth.check");
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: typeof api.auth.login.input._type) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error(data.message || "Invalid credentials");
        }
        throw new Error("Failed to login");
      }
      
      return parseWithLogging(api.auth.login.responses[200], data, "auth.login");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.check.path] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.auth.logout.path, { 
        method: api.auth.logout.method,
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to logout");
      const data = await res.json();
      return parseWithLogging(api.auth.logout.responses[200], data, "auth.logout");
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.check.path], { authenticated: false });
      queryClient.clear(); // Clear all other caches on logout
    },
  });

  return {
    isAuthenticated: !!auth?.authenticated,
    isLoading,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
  };
}
