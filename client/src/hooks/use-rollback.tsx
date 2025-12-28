
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RollbackResult {
  success: boolean;
  message: string;
  restoredData?: any;
}

export function useRollback() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const rollbackMutation = useMutation({
    mutationFn: async (auditLogId: string): Promise<RollbackResult> => {
      const res = await apiRequest("POST", `/api/audit/rollback/${auditLogId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Ошибка при откате изменений");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Успешно",
          description: data.message,
        });
        // Invalidate all queries to refresh data
        queryClient.invalidateQueries();
      } else {
        toast({
          title: "Ошибка",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    rollback: rollbackMutation.mutate,
    isRollingBack: rollbackMutation.isPending,
  };
}
