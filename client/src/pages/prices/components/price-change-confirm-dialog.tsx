import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertTriangle, Package, Plane, Truck, Car } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AffectedDeal {
  dealType: string;
  dealId: string;
  dealNumber: string;
  dealDate: string;
  counterpartyName: string;
  quantityKg: string | null;
  role: "purchase" | "sale";
}

interface PriceChangeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceId: string;
  newPriceValues: string[];
  oldPriceDisplay: string;
  newPriceDisplay: string;
  otherData?: Record<string, any>;
  onConfirmed: () => void;
}

const DEAL_TYPE_LABELS: Record<string, string> = {
  opt: "ОПТ",
  refueling: "Заправка ВС",
  movement: "Движение",
  transportation: "Перевозка",
};

const DEAL_TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  opt: Package,
  refueling: Plane,
  movement: Truck,
  transportation: Car,
};

function formatKg(val: string | null) {
  if (!val) return "—";
  const n = parseFloat(val);
  return isNaN(n) ? "—" : n.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " кг";
}

export function PriceChangeConfirmDialog({
  open,
  onOpenChange,
  priceId,
  newPriceValues,
  oldPriceDisplay,
  newPriceDisplay,
  otherData,
  onConfirmed,
}: PriceChangeConfirmDialogProps) {
  const { toast } = useToast();
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  const { data: affectedDeals, isLoading } = useQuery<AffectedDeal[]>({
    queryKey: [`/api/prices/${priceId}/affected-deals`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/prices/${priceId}/affected-deals`);
      return res.json();
    },
    enabled: open && !!priceId,
    staleTime: 0,
  });

  // Initialize all checkboxes as checked when deals load
  if (affectedDeals && !initialized) {
    const allIds = new Set(affectedDeals.map((d) => d.dealId));
    setSelectedDealIds(allIds);
    setInitialized(true);
  }

  // Reset initialized state when dialog closes
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setInitialized(false);
      setSelectedDealIds(new Set());
    }
    onOpenChange(v);
  };

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/prices/${priceId}/confirm-recalculation`, {
        newPriceValues,
        selectedDeals: (affectedDeals || [])
          .filter((d) => selectedDealIds.has(d.dealId))
          .map((d) => ({ dealType: d.dealType, dealId: d.dealId })),
        otherData: otherData || {},
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Ошибка подтверждения");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prices/list"] });
      toast({
        title: "Цена обновлена",
        description: "Изменение цены подтверждено. Ожидает пересчёта администратором.",
      });
      handleOpenChange(false);
      onConfirmed();
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const toggleDeal = (dealId: string) => {
    setSelectedDealIds((prev) => {
      const next = new Set(prev);
      if (next.has(dealId)) next.delete(dealId);
      else next.add(dealId);
      return next;
    });
  };

  const toggleAll = () => {
    if (!affectedDeals) return;
    if (selectedDealIds.size === affectedDeals.length) {
      setSelectedDealIds(new Set());
    } else {
      setSelectedDealIds(new Set(affectedDeals.map((d) => d.dealId)));
    }
  };

  const allChecked =
    !!affectedDeals && affectedDeals.length > 0 && selectedDealIds.size === affectedDeals.length;
  const someChecked = selectedDealIds.size > 0 && !allChecked;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Изменение цены затронет существующие сделки
          </DialogTitle>
          <DialogDescription>
            Вы изменяете значение цены с{" "}
            <span className="font-semibold text-foreground">{oldPriceDisplay}</span> на{" "}
            <span className="font-semibold text-foreground">{newPriceDisplay}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-3 text-sm text-amber-800 dark:text-amber-300">
            Данное изменение цены затронет указанные ниже сделки и изменит их экономику. Выберите
            сделки, которые должны быть включены в очередь пересчёта (пересчёт начнётся только
            после подтверждения администратором).
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !affectedDeals || affectedDeals.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Задетых сделок не найдено. Цена будет обновлена.
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={allChecked}
                        data-state={someChecked ? "indeterminate" : allChecked ? "checked" : "unchecked"}
                        onCheckedChange={toggleAll}
                        data-testid="checkbox-select-all-deals"
                      />
                    </TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Сделка</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Контрагент</TableHead>
                    <TableHead>Роль цены</TableHead>
                    <TableHead className="text-right">Объём</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affectedDeals.map((deal) => {
                    const Icon = DEAL_TYPE_ICONS[deal.dealType] || Package;
                    return (
                      <TableRow
                        key={deal.dealId}
                        className="cursor-pointer"
                        onClick={() => toggleDeal(deal.dealId)}
                        data-testid={`row-affected-deal-${deal.dealId}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedDealIds.has(deal.dealId)}
                            onCheckedChange={() => toggleDeal(deal.dealId)}
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`checkbox-deal-${deal.dealId}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs">{DEAL_TYPE_LABELS[deal.dealType] || deal.dealType}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{deal.dealNumber}</TableCell>
                        <TableCell className="text-xs">{deal.dealDate}</TableCell>
                        <TableCell className="text-xs">{deal.counterpartyName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {deal.role === "purchase" ? "Закупка" : "Продажа"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs">{formatKg(deal.quantityKg)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {affectedDeals && affectedDeals.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Выбрано {selectedDealIds.size} из {affectedDeals.length} сделок для включения в
              очередь пересчёта.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            data-testid="button-cancel-price-change"
          >
            Отмена
          </Button>
          <Button
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending}
            data-testid="button-confirm-price-change"
          >
            {confirmMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              "Подтвердить изменение"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
