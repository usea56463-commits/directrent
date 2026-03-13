import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { parseWithLogging } from "@/lib/zod-helper";

export function useVisitors() {
  return useQuery({
    queryKey: [api.visitors.list.path],
    queryFn: async () => {
      const res = await fetch(api.visitors.list.path, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Unauthorized");
        throw new Error("Failed to fetch visitors");
      }
      const data = await res.json();
      return parseWithLogging(api.visitors.list.responses[200], data, "visitors.list");
    },
    // Refetch every 10 seconds for live tracking dashboard
    refetchInterval: 10000,
  });
}

export function useVisitor(id: number) {
  return useQuery({
    queryKey: [api.visitors.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.visitors.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch visitor");
      const data = await res.json();
      return parseWithLogging(api.visitors.get.responses[200], data, `visitors.get[${id}]`);
    },
  });
}

export function useTrackVisitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: typeof api.visitors.track.input._type) => {
      const res = await fetch(api.visitors.track.path, {
        method: api.visitors.track.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
        credentials: "include",
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to track visitor");
      
      return parseWithLogging(api.visitors.track.responses[201], data, "visitors.track");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.visitors.list.path] });
    },
  });
}
