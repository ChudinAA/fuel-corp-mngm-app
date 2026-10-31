import { useMutation } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type CounterpartyType = "supplier" | "customer" | "carrier";

export function IntegrationPendingReviewActions({
  type,
  entityId,
  entityName,
}: {
  type: CounterpartyType;
  entityId: string;
  entityName: string;
}) {
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async (action: "approve" | "reject") => {
      const response = await apiRequest(
        "POST",
        `/api/admin/integrations/1c/entities/${type}/${entityId}/review`,
        { action },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Не удалось обработать запись");
      return action;
    },
    onSuccess: (action) => {
      for (const key of [
        ["/api/admin/integrations/1c/status"],
        ["/api/admin/integrations/1c/pending"],
        ["/api/admin/integrations/1c/logs"],
        ["/api/suppliers"],
        ["/api/customers"],
        ["/api/logistics/carriers"],
      ]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      toast({ title: action === "approve" ? "Запись подтверждена" : "Запись отклонена" });
    },
    onError: (error: Error) => {
      toast({ title: "Не удалось обработать запись", description: error.message, variant: "destructive" });
    },
  });

  const reject = () => {
    if (window.confirm(`Отклонить запись «${entityName}»? Она будет мягко удалена из справочника.`)) {
      mutation.mutate("reject");
    }
  };

  return (
    <div className="flex items-center gap-1" data-testid={`integration-review-${type}-${entityId}`}>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-emerald-700 hover:text-emerald-800"
        title="Подтвердить запись из 1С"
        aria-label={`Подтвердить ${entityName}`}
        onClick={() => mutation.mutate("approve")}
        disabled={mutation.isPending}
      >
        {mutation.isPending && mutation.variables === "approve"
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Check className="h-4 w-4" />}
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-destructive hover:text-destructive"
        title="Отклонить запись из 1С"
        aria-label={`Отклонить ${entityName}`}
        onClick={reject}
        disabled={mutation.isPending}
      >
        {mutation.isPending && mutation.variables === "reject"
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <X className="h-4 w-4" />}
      </Button>
    </div>
  );
}
