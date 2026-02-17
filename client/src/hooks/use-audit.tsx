import { useInfiniteQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  operation: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
  userId: string;
  userName: string;
  userEmail: string;
  changedFields: string[] | null;
  oldData: Record<string, any> | null;
  newData: Record<string, any> | null;
  entityDeleted: string | null;
  createdAt: string;
  rolledBackAt: string | null;
  rolledBackById: string | null;
}

interface UseAuditOptions {
  entityType: string;
  entityId?: string;
  limit?: number;
  enabled?: boolean;
}

export function useAudit({
  entityType,
  entityId,
  limit = 25,
  enabled = true,
}: UseAuditOptions) {
  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<{ data: AuditEntry[]; total: number }>({
    queryKey: ["audit", entityType, entityId || "all", limit],
    queryFn: async ({ pageParam = 0 }) => {
      const endpoint = entityId
        ? `/api/audit/${entityType}/${entityId}?limit=${limit}&offset=${pageParam}`
        : `/api/audit/${entityType}?limit=${limit}&offset=${pageParam}`;

      const res = await apiRequest("GET", endpoint);
      if (!res.ok) {
        throw new Error("Failed to fetch audit history");
      }
      return res.json();
    },
    enabled: enabled && !!entityType,
    staleTime: 30000, // 30 seconds
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.length * limit;
      return loadedCount < lastPage.total ? loadedCount : undefined;
    },
  });

  return {
    auditHistory: data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  };
}
