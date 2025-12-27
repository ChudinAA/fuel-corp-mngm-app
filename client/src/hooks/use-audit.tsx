
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
  userId: string;
  userName: string;
  userEmail: string;
  changes: Record<string, any> | null;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  createdAt: string;
}

interface UseAuditOptions {
  entityType: string;
  entityId?: string;
  limit?: number;
  enabled?: boolean;
}

export function useAudit({ entityType, entityId, limit = 50, enabled = true }: UseAuditOptions) {
  const endpoint = entityId 
    ? `/api/audit/${entityType}/${entityId}?limit=${limit}`
    : `/api/audit/${entityType}?limit=${limit}`;

  const { data, isLoading, error, refetch } = useQuery<AuditEntry[]>({
    queryKey: ["audit", entityType, entityId, limit],
    queryFn: async () => {
      const res = await apiRequest("GET", endpoint);
      if (!res.ok) {
        throw new Error("Failed to fetch audit history");
      }
      return res.json();
    },
    enabled: enabled && !!entityType,
    staleTime: 30000, // 30 seconds
  });

  return {
    auditHistory: data || [],
    isLoading,
    error,
    refetch,
  };
}
