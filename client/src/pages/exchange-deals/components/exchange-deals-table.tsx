import { useState, useMemo, useRef, useEffect } from "react";
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
import { Search, Plus, Loader2, Pencil, Copy, Trash2 } from "lucide-react";
import { EntityActionsMenu, type EntityAction } from "@/components/entity-actions-menu";
import { TableColumnFilter } from "@/components/ui/table-column-filter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useExchangeDealsTable } from "../hooks/use-exchange-deals-table";

function formatNum(val: string | number | null | undefined, decimals = 3) {
  if (!val || val === "0") return "—";
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

function formatCompact(val: number) {
  if (!val || val === 0) return "—";
  return val.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

interface ExchangeDealsTableProps {
  onEdit: (deal: any) => void;
  onCopy: (deal: any) => void;
  onAdd?: () => void;
  onDelete?: () => void;
}

interface DealActionsProps {
  deal: any;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

function DealActions({ deal, onEdit, onCopy, onDelete }: DealActionsProps) {
  const actions: EntityAction[] = [
    {
      id: "copy",
      label: "Создать копию",
      icon: Copy,
      onClick: onCopy,
      permission: { module: "exchange-deals", action: "create" },
    },
    {
      id: "edit",
      label: "Редактировать",
      icon: Pencil,
      onClick: onEdit,
      permission: { module: "exchange-deals", action: "edit" },
    },
    {
      id: "delete",
      label: "Удалить",
      icon: Trash2,
      onClick: onDelete,
      variant: "destructive" as const,
      permission: { module: "exchange-deals", action: "delete" },
      separatorAfter: true,
    },
  ];

  return (
    <EntityActionsMenu
      actions={actions}
      audit={{
        entityType: "exchange_deals",
        entityId: deal.id,
        entityName: deal.dealNumber || `Сделка ${formatDate(deal.dealDate)}`,
      }}
    />
  );
}

export function ExchangeDealsTable({ onEdit, onCopy, onAdd, onDelete }: ExchangeDealsTableProps) {
  const { hasPermission } = useAuth();
  const {
    search,
    setSearch,
    dealsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    columnFilters,
    setColumnFilters,
    handleDelete,
  } = useExchangeDealsTable();

  const deals = useMemo(
    () => dealsData?.pages.flatMap((page: any) => page.data) || [],
    [dealsData],
  );

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<any>(null);
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cursorPositionRef = useRef<number>(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 500);
    return () => clearTimeout(timer);
  }, [searchInput, setSearch]);

  useEffect(() => {
    if (searchInputRef.current && searchInput) {
      const input = searchInputRef.current;
      input.focus();
      input.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
    }
  }, [deals]);

  const handleFilterUpdate = (key: string, values: string[]) => {
    setColumnFilters((prev) => ({ ...prev, [key]: values }));
  };

  const getUniqueOptions = (field: string) => {
    const vals = deals
      .map((d: any) => (field === "dealDate" ? formatDate(d.dealDate) : d[field]))
      .filter(Boolean);
    return Array.from(new Set(vals)).map((v) => ({ value: String(v), label: String(v) }));
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Поиск по номеру, контрагенту..."
            value={searchInput}
            onChange={(e) => {
              cursorPositionRef.current = e.target.selectionStart || 0;
              setSearchInput(e.target.value);
            }}
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

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold p-1 w-[90px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Дата</span>
                  <TableColumnFilter
                    title="Дата"
                    options={getUniqueOptions("dealDate")}
                    selectedValues={columnFilters["date"] || []}
                    onUpdate={(v) => handleFilterUpdate("date", v)}
                    dataTestId="filter-date"
                  />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold p-1 w-[90px]">
                <div className="flex items-center justify-between gap-1">
                  <span>№ сделки</span>
                  <TableColumnFilter
                    title="Номер"
                    options={getUniqueOptions("dealNumber")}
                    selectedValues={columnFilters["dealNumber"] || []}
                    onUpdate={(v) => handleFilterUpdate("dealNumber", v)}
                    dataTestId="filter-deal-number"
                  />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold p-1 w-[100px]">Ст. отпр.</TableHead>
              <TableHead className="text-xs font-semibold p-1 w-[100px]">Ст. назн.</TableHead>
              <TableHead className="text-xs font-semibold p-1 w-[110px]">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate max-w-[75px]">Покупатель</span>
                  <TableColumnFilter
                    title="Покупатель"
                    options={getUniqueOptions("buyerName")}
                    selectedValues={columnFilters["buyer"] || []}
                    onUpdate={(v) => handleFilterUpdate("buyer", v)}
                    dataTestId="filter-buyer"
                  />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold p-1 w-[90px]">Дата опл.</TableHead>
              <TableHead className="text-right text-xs font-semibold p-1 w-[75px]">
                Цена/тн
              </TableHead>
              <TableHead className="text-right text-xs font-semibold p-1 w-[60px]">Вес</TableHead>
              <TableHead className="text-right text-xs font-semibold p-1 w-[65px]">Вес ф.</TableHead>
              <TableHead className="text-right text-xs font-semibold p-1 w-[90px]">
                Сумма пок.
              </TableHead>
              <TableHead className="text-xs font-semibold p-1 w-[95px]">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate max-w-[60px]">Тариф</span>
                  <TableColumnFilter
                    title="Тариф"
                    options={getUniqueOptions("tariffZoneName")}
                    selectedValues={columnFilters["tariff"] || []}
                    onUpdate={(v) => handleFilterUpdate("tariff", v)}
                    dataTestId="filter-tariff"
                  />
                </div>
              </TableHead>
              <TableHead className="text-right text-xs font-semibold p-1 w-[85px]">
                Доставка
              </TableHead>
              <TableHead className="text-right text-xs font-semibold p-1 w-[85px]">Итого</TableHead>
              <TableHead className="text-right text-xs font-semibold p-1 w-[80px]">
                Цена ит.
              </TableHead>
              <TableHead className="text-xs font-semibold p-1 w-[90px]">Отпр. ваг.</TableHead>
              <TableHead className="text-xs font-semibold p-1 w-[90px]">Пл. дост.</TableHead>
              <TableHead className="text-xs font-semibold p-1 w-[105px]">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate max-w-[70px]">Продавец</span>
                  <TableColumnFilter
                    title="Продавец"
                    options={getUniqueOptions("sellerName")}
                    selectedValues={columnFilters["seller"] || []}
                    onUpdate={(v) => handleFilterUpdate("seller", v)}
                    dataTestId="filter-seller"
                  />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold p-1 w-[120px]">Вагоны / Накладная</TableHead>
              <TableHead className="text-right text-xs font-semibold p-1 w-[80px]">
                Резерв 5%
              </TableHead>
              <TableHead className="w-[32px] p-1 sticky right-0 bg-background z-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={20}
                  className="text-center py-8 text-muted-foreground text-xs"
                >
                  Нет данных для отображения
                </TableCell>
              </TableRow>
            ) : (
              deals.map((deal: any) => {
                const pricePerTon = Number(deal.pricePerTon || 0);
                const weightTon = Number(deal.weightTon || 0);
                const tariffPrice = Number(deal.tariffPricePerTon || 0);
                const purchaseAmount = pricePerTon * weightTon;
                const deliveryCostTotal = tariffPrice * weightTon;
                const totalCost = purchaseAmount + deliveryCostTotal;
                const costPerTon = weightTon > 0 ? totalCost / weightTon : 0;
                const reserved = totalCost * 0.05;

                return (
                  <TableRow
                    key={deal.id}
                    data-testid={`row-deal-${deal.id}`}
                    className={cn(
                      deal.isDraft && "bg-muted/70 opacity-60 border-2 border-orange-200",
                      deal.buyerSupplierId && !deal.isReceivedAtWarehouse && !deal.isDraft &&
                        "bg-orange-50/60 dark:bg-orange-950/20 border-l-2 border-l-orange-300 dark:border-l-orange-700",
                    )}
                  >
                    <TableCell className="text-[10px] py-1.5 px-1">
                      <div className="flex flex-col gap-0.5">
                        <span>{formatDate(deal.dealDate)}</span>
                        {deal.isDraft && (
                          <Badge
                            variant="secondary"
                            className="w-fit text-[9px] h-4 px-1 bg-yellow-100 text-yellow-800 border-yellow-200"
                          >
                            Черновик
                          </Badge>
                        )}
                        {deal.buyerSupplierId && !deal.isReceivedAtWarehouse && (
                          <Badge
                            variant="secondary"
                            className="w-fit text-[9px] h-4 px-1 bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700"
                          >
                            не получен на складе
                          </Badge>
                        )}
                        {deal.isReceivedAtWarehouse && (
                          <Badge
                            variant="secondary"
                            className="w-fit text-[9px] h-4 px-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700"
                          >
                            Получено
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-[10px] py-1.5 px-1 font-medium">
                      {deal.dealNumber || "—"}
                    </TableCell>
                    <TableCell className="text-[10px] py-1.5 px-1">
                      <span className="truncate max-w-[90px] block">{deal.departureName || "—"}</span>
                    </TableCell>
                    <TableCell className="text-[10px] py-1.5 px-1">
                      <span className="truncate max-w-[90px] block">
                        {deal.destinationName || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-[10px] py-1.5 px-1">
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate max-w-[90px] block">
                          {deal.buyerName || deal.buyerSupplierName || "—"}
                        </span>
                        {deal.buyerSupplierName && (
                          <span className="text-[9px] text-blue-600 dark:text-blue-400">склад</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-[10px] py-1.5 px-1">
                      {formatDate(deal.paymentDate)}
                    </TableCell>
                    <TableCell className="text-right text-[10px] py-1.5 px-1">
                      {pricePerTon > 0 ? pricePerTon.toLocaleString("ru-RU") : "—"}
                    </TableCell>
                    <TableCell className="text-right text-[10px] py-1.5 px-1">
                      {formatNum(deal.weightTon)}
                    </TableCell>
                    <TableCell className="text-right text-[10px] py-1.5 px-1">
                      {formatNum(deal.actualWeightTon)}
                    </TableCell>
                    <TableCell className="text-right text-[10px] py-1.5 px-1">
                      {formatCompact(purchaseAmount)}
                    </TableCell>
                    <TableCell className="text-[10px] py-1.5 px-1">
                      <span className="truncate max-w-[85px] block">
                        {deal.tariffZoneName || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-[10px] py-1.5 px-1">
                      {formatCompact(deliveryCostTotal)}
                    </TableCell>
                    <TableCell className="text-right text-[10px] py-1.5 px-1">
                      {formatCompact(totalCost)}
                    </TableCell>
                    <TableCell className="text-right text-[10px] py-1.5 px-1">
                      {formatCompact(costPerTon)}
                    </TableCell>
                    <TableCell className="text-[10px] py-1.5 px-1">
                      {formatDate(deal.wagonDepartureDate)}
                    </TableCell>
                    <TableCell className="text-[10px] py-1.5 px-1">
                      {formatDate(deal.plannedDeliveryDate)}
                    </TableCell>
                    <TableCell className="text-[10px] py-1.5 px-1">
                      <span className="truncate max-w-[90px] block">{deal.sellerName || "—"}</span>
                    </TableCell>
                    <TableCell className="text-[10px] py-1.5 px-1">
                      <div className="flex flex-col gap-0.5">
                        {deal.wagonNumbers && (
                          <span className="truncate max-w-[110px] block">{deal.wagonNumbers}</span>
                        )}
                        {deal.railwayInvoice && (
                          <span className="truncate max-w-[110px] block text-muted-foreground">
                            {deal.railwayInvoice}
                          </span>
                        )}
                        {!deal.wagonNumbers && !deal.railwayInvoice && "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-[10px] py-1.5 px-1">
                      {formatCompact(reserved)}
                    </TableCell>
                    <TableCell className="py-1.5 px-1 sticky right-0 bg-background z-10">
                      <DealActions
                        deal={deal}
                        onEdit={() => onEdit(deal)}
                        onCopy={() => onCopy(deal)}
                        onDelete={() => {
                          setDealToDelete(deal);
                          setDeleteDialogOpen(true);
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

      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            data-testid="button-load-more"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Загрузка...
              </>
            ) : (
              "Загрузить ещё"
            )}
          </Button>
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (dealToDelete) {
            handleDelete(dealToDelete.id);
            onDelete?.();
          }
          setDeleteDialogOpen(false);
          setDealToDelete(null);
        }}
        title="Удалить сделку?"
        description={`Удалить сделку "${dealToDelete?.dealNumber || formatDate(dealToDelete?.dealDate)}"? Это действие нельзя отменить.`}
      />
    </div>
  );
}
