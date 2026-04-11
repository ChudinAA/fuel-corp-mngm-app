import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, Loader2, Pencil, Copy, Trash2, History } from "lucide-react";
import { EntityActionsMenu, type EntityAction } from "@/components/entity-actions-menu";
import { AuditPanel } from "@/components/audit-panel";
import { TableColumnFilter } from "@/components/ui/table-column-filter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function formatMoney(val: string | number | null | undefined) {
  if (!val) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(Number(val));
}

function formatNum(val: string | number | null | undefined, decimals = 3) {
  if (!val) return "—";
  return Number(val).toFixed(decimals);
}

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try {
    return format(new Date(val), "dd.MM.yyyy", { locale: ru });
  } catch {
    return val;
  }
}

interface ExchangeDealsTableProps {
  onEdit: (deal: any) => void;
  onCopy: (deal: any) => void;
  onAdd?: () => void;
  onDelete?: () => void;
}

export function ExchangeDealsTable({ onEdit, onCopy, onAdd, onDelete }: ExchangeDealsTableProps) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [allDeals, setAllDeals] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const [auditDeal, setAuditDeal] = useState<any | null>(null);
  const isFirstLoad = useRef(true);

  const queryParams = new URLSearchParams({
    offset: String(offset),
    pageSize: String(PAGE_SIZE),
    ...(search ? { search } : {}),
  });
  Object.entries(filters).forEach(([k, v]) => {
    if (v.length) queryParams.set(`filter_${k}`, v.join(","));
  });

  const { data, isLoading, isFetching } = useQuery<{ data: any[]; total: number }>({
    queryKey: ["/api/exchange-deals", offset, search, filters],
    queryFn: async () => {
      const res = await fetch(`/api/exchange-deals?${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки");
      return res.json();
    },
  });

  useEffect(() => {
    if (!data) return;
    if (offset === 0) {
      setAllDeals(data.data);
    } else {
      setAllDeals((prev) => [...prev, ...data.data]);
    }
    setHasMore(data.data.length === PAGE_SIZE);
  }, [data, offset]);

  useEffect(() => {
    setOffset(0);
    setAllDeals([]);
  }, [search, filters]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/exchange-deals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-deals"] });
      toast({ title: "Сделка удалена" });
      setDeleteOpen(false);
      onDelete?.();
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const copyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/exchange-deals/${id}/copy`);
      return res;
    },
    onSuccess: (copy: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-deals"] });
      toast({ title: "Сделка скопирована", description: "Черновик создан" });
      onEdit(copy);
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const handleLoadMore = () => {
    setOffset((prev) => prev + PAGE_SIZE);
  };

  // Get unique filter values from loaded data
  const getFilterValues = (field: string) => {
    const vals = allDeals.map((d) => d[field]).filter(Boolean);
    return Array.from(new Set(vals)).map((v) => ({ value: String(v), label: String(v) }));
  };

  const setFilter = (key: string, values: string[]) => {
    setFilters((prev) => ({ ...prev, [key]: values }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по номеру, контрагенту..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-deals"
          />
        </div>
        {onAdd && hasPermission("exchange-deals", "create") && (
          <Button onClick={onAdd} data-testid="button-add-exchange-deal">
            <Plus className="h-4 w-4 mr-1" />
            Новая сделка
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-28">
                <TableColumnFilter
                  title="№ сделки"
                  options={getFilterValues("dealNumber")}
                  selectedValues={filters.dealNumber || []}
                  onUpdate={(v) => setFilter("dealNumber", v)}
                />
              </TableHead>
              <TableHead className="min-w-28">
                <TableColumnFilter
                  title="Дата"
                  options={getFilterValues("dealDate").map((v) => ({
                    value: v.value,
                    label: formatDate(v.value),
                  }))}
                  selectedValues={filters.date || []}
                  onUpdate={(v) => setFilter("date", v)}
                />
              </TableHead>
              <TableHead className="min-w-32">Ст. отправления</TableHead>
              <TableHead className="min-w-32">Ст. назначения</TableHead>
              <TableHead className="min-w-36">
                <TableColumnFilter
                  title="Покупатель"
                  options={getFilterValues("buyerName")}
                  selectedValues={filters.buyer || []}
                  onUpdate={(v) => setFilter("buyer", v)}
                />
              </TableHead>
              <TableHead className="min-w-28">Дата оплаты</TableHead>
              <TableHead className="min-w-28 text-right">Цена/тн, руб</TableHead>
              <TableHead className="min-w-24 text-right">Вес, тн</TableHead>
              <TableHead className="min-w-24 text-right">Вес факт., тн</TableHead>
              <TableHead className="min-w-32 text-right">Сумма закупки</TableHead>
              <TableHead className="min-w-32">Тариф доставки</TableHead>
              <TableHead className="min-w-32 text-right">Доставка всего</TableHead>
              <TableHead className="min-w-32 text-right">Себест. с доставкой</TableHead>
              <TableHead className="min-w-28 text-right">Себест./тн</TableHead>
              <TableHead className="min-w-28">Дата выхода</TableHead>
              <TableHead className="min-w-28">Дата поставки</TableHead>
              <TableHead className="min-w-36">
                <TableColumnFilter
                  title="Продавец"
                  options={getFilterValues("sellerName")}
                  selectedValues={filters.seller || []}
                  onUpdate={(v) => setFilter("seller", v)}
                />
              </TableHead>
              <TableHead className="min-w-40">Вагоны / Накладная</TableHead>
              <TableHead className="min-w-28 text-right">Зарезерв. (5%)</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && offset === 0 ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(20)].map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : allDeals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={20} className="text-center text-muted-foreground py-8">
                  Нет данных
                </TableCell>
              </TableRow>
            ) : (
              allDeals.map((deal) => {
                const pricePerTon = parseFloat(deal.pricePerTon || "0");
                const weightTon = parseFloat(deal.weightTon || "0");
                const tariffPrice = parseFloat(deal.tariffPricePerTon || "0");
                const purchaseAmount = weightTon * pricePerTon;
                const deliveryCostTotal = tariffPrice * weightTon;
                const totalCost = purchaseAmount + deliveryCostTotal;
                const costPerTon = weightTon > 0 ? totalCost / weightTon : 0;
                const reserved = purchaseAmount * 0.05;

                return (
                  <TableRow
                    key={deal.id}
                    data-testid={`row-deal-${deal.id}`}
                    className={cn(deal.isDraft && "opacity-60 italic")}
                  >
                    <TableCell className="font-medium">
                      {deal.dealNumber || "—"}
                      {deal.isDraft && <Badge variant="outline" className="ml-1 text-xs">Черновик</Badge>}
                    </TableCell>
                    <TableCell>{formatDate(deal.dealDate)}</TableCell>
                    <TableCell>{deal.departureName || "—"}</TableCell>
                    <TableCell>{deal.destinationName || "—"}</TableCell>
                    <TableCell>{deal.buyerName || "—"}</TableCell>
                    <TableCell>{formatDate(deal.paymentDate)}</TableCell>
                    <TableCell className="text-right">{formatMoney(deal.pricePerTon)}</TableCell>
                    <TableCell className="text-right">{formatNum(deal.weightTon)}</TableCell>
                    <TableCell className="text-right">{formatNum(deal.actualWeightTon)}</TableCell>
                    <TableCell className="text-right">{formatMoney(purchaseAmount)}</TableCell>
                    <TableCell>{deal.tariffZoneName || "—"}</TableCell>
                    <TableCell className="text-right">{formatMoney(deliveryCostTotal)}</TableCell>
                    <TableCell className="text-right">{formatMoney(totalCost)}</TableCell>
                    <TableCell className="text-right">{formatMoney(costPerTon)}</TableCell>
                    <TableCell>{formatDate(deal.wagonDepartureDate)}</TableCell>
                    <TableCell>{formatDate(deal.plannedDeliveryDate)}</TableCell>
                    <TableCell>{deal.sellerName || "—"}</TableCell>
                    <TableCell className="max-w-40 truncate">{deal.wagonNumbers || "—"}</TableCell>
                    <TableCell className="text-right">{formatMoney(reserved)}</TableCell>
                    <TableCell>
                      <EntityActionsMenu
                        actions={[
                          {
                            id: "edit",
                            label: "Редактировать",
                            icon: Pencil,
                            onClick: () => onEdit(deal),
                            permission: { module: "exchange-deals", action: "edit" },
                          },
                          {
                            id: "copy",
                            label: "Копировать",
                            icon: Copy,
                            onClick: () => copyMutation.mutate(deal.id),
                            permission: { module: "exchange-deals", action: "create" },
                          },
                          {
                            id: "delete",
                            label: "Удалить",
                            icon: Trash2,
                            variant: "destructive",
                            onClick: () => {
                              setToDelete({ id: deal.id, name: deal.dealNumber || "Сделка" });
                              setDeleteOpen(true);
                            },
                            permission: { module: "exchange-deals", action: "delete" },
                            separatorAfter: true,
                          },
                          {
                            id: "history",
                            label: "История изменений",
                            icon: History,
                            onClick: () => setAuditDeal(deal),
                          },
                        ] satisfies EntityAction[]}
                        audit={{
                          entityType: "exchange_deals",
                          entityId: deal.id,
                          entityName: deal.dealNumber || "Сделка",
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {hasMore && !isLoading && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={handleLoadMore} disabled={isFetching} data-testid="button-load-more">
            {isFetching ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Загрузка...</> : "Загрузить ещё"}
          </Button>
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => { if (toDelete) deleteMutation.mutate(toDelete.id); }}
        title="Удалить сделку"
        description={`Удалить сделку "${toDelete?.name}"?`}
      />

      <AuditPanel
        entityType="exchange_deals"
        entityId={auditDeal?.id || ""}
        entityName={auditDeal ? `Сделка ${auditDeal.dealNumber || auditDeal.id}` : ""}
        open={!!auditDeal}
        onOpenChange={(o) => { if (!o) setAuditDeal(null); }}
      />
    </div>
  );
}
