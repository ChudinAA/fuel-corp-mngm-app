import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Warehouse,
  AlertCircle,
  History,
  Copy,
  Loader2,
} from "lucide-react";
import {
  EntityActionsMenu,
  EntityAction,
} from "@/components/entity-actions-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  formatNumber,
  formatNumberForTable,
  formatCurrencyForTable,
  getProductLabel,
} from "../utils";
import { useRefuelingTable } from "../hooks/use-refueling-table";
import { PRODUCT_TYPE } from "@shared/constants";
import { useAuth } from "@/hooks/use-auth";
import { AuditPanel } from "@/components/audit-panel";
import { ExportButton } from "@/components/export/export-button";
import { cn } from "@/lib/utils";

import { TableColumnFilter } from "@/components/ui/table-column-filter";

interface RefuelingDealActionsProps {
  deal: any;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

function RefuelingDealActions({
  deal,
  onEdit,
  onCopy,
  onDelete,
}: RefuelingDealActionsProps) {
  const actions: EntityAction[] = [
    {
      id: "copy",
      label: "Создать копию",
      icon: Copy,
      onClick: onCopy,
      permission: { module: "refueling", action: "create" },
    },
    {
      id: "edit",
      label: "Редактировать",
      icon: Pencil,
      onClick: onEdit,
      permission: { module: "refueling", action: "edit" },
    },
    {
      id: "delete",
      label: "Удалить",
      icon: Trash2,
      onClick: onDelete,
      variant: "destructive" as const,
      permission: { module: "refueling", action: "delete" },
      separatorAfter: true,
    },
  ];

  return (
    <EntityActionsMenu
      actions={actions}
      audit={{
        entityType: "aircraft_refueling",
        entityId: deal.id,
        entityName: `Заправка от ${new Date(deal.refuelingDate).toLocaleDateString("ru-RU")}`,
      }}
    />
  );
}

interface RefuelingTableProps {
  onEdit: (refueling: any) => void;
  onCopy: (refueling: any) => void;
  onDelete?: () => void;
}

export function RefuelingTable({
  onEdit,
  onCopy,
  onDelete,
}: RefuelingTableProps) {
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const { hasPermission } = useAuth();
  const {
    refuelingDeals,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    search,
    setSearch,
    columnFilters,
    setColumnFilters,
    deleteMutation,
    handleDelete,
  } = useRefuelingTable() as any;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<any>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedDealNotes, setSelectedDealNotes] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cursorPositionRef = useRef<number>(0);
  const [deletedDealsAuditOpen, setDeletedDealsAuditOpen] = useState(false);

  // Генерируем опции для фильтров на основе данных
  const getUniqueOptions = (key: string) => {
    const deals = refuelingDeals?.data || [];
    const values = new Map<string, string>();
    deals.forEach((deal: any) => {
      if (key === "refuelingDate") {
        const val = formatDate(deal.refuelingDate);
        values.set(val, val);
      } else if (key === "productType") {
        const label = getProductLabel(deal.productType);
        values.set(label, deal.productType);
      } else if (key.includes(".")) {
        const val = key.split(".").reduce((obj, k) => obj?.[k], deal);
        const label = typeof val === "object" ? val?.name : val;
        if (label) values.set(label, label);
      } else {
        const val = deal[key];
        const label = typeof val === "object" ? val?.name : val;
        if (label) values.set(label, label);
      }
    });
    return Array.from(values.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }));
  };

  const handleFilterUpdate = (columnId: string, values: string[]) => {
    setColumnFilters((prev: Record<string, string[]>) => ({
      ...prev,
      [columnId]: values,
    }));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput, setSearch]);

  useEffect(() => {
    if (searchInputRef.current && searchInput) {
      const input = searchInputRef.current;
      input.focus();
      input.setSelectionRange(
        cursorPositionRef.current,
        cursorPositionRef.current,
      );
    }
  }, [refuelingDeals]);

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const allDeals = (refuelingDeals as any)?.data || [];
  const filteredDeals = allDeals;

  const deals = filteredDeals;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Поиск по поставщику, покупателю..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              cursorPositionRef.current = e.target.selectionStart || 0;
            }}
            className="pl-9"
            data-testid="input-search-refueling"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setColumnFilters({})}
          disabled={Object.values(columnFilters).every(
            (v: any) => v.length === 0,
          )}
          title="Сбросить все фильтры"
          className={cn(
            Object.values(columnFilters).some((v: any) => v.length > 0) &&
              "text-primary border-primary",
          )}
        >
          <Filter className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={() => setDeletedDealsAuditOpen(true)}
          title="Аудит всех заправок"
        >
          <History className="h-4 w-4 mr-2" />
          История изменений
        </Button>
        <ExportButton module="refueling" />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-sm font-semibold p-1 md:p-2 w-[90px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Дата</span>
                  <TableColumnFilter
                    title="Дата"
                    options={getUniqueOptions("refuelingDate")}
                    selectedValues={columnFilters["date"] || []}
                    onUpdate={(values) => handleFilterUpdate("date", values)}
                    dataTestId="filter-date"
                  />
                </div>
              </TableHead>
              <TableHead className="text-sm font-semibold p-1 md:p-2">
                <div className="flex items-center justify-between gap-1">
                  <span>Продукт</span>
                  <TableColumnFilter
                    title="Продукт"
                    options={getUniqueOptions("productType")}
                    selectedValues={columnFilters["productType"] || []}
                    onUpdate={(values) =>
                      handleFilterUpdate("productType", values)
                    }
                    dataTestId="filter-product"
                  />
                </div>
              </TableHead>
              <TableHead className="text-sm font-semibold p-1 md:p-2">
                Борт
              </TableHead>
              <TableHead className="text-sm font-semibold p-1 md:p-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate max-w-[80px] md:max-w-none">
                    Поставщик
                  </span>
                  <TableColumnFilter
                    title="Поставщик"
                    options={getUniqueOptions("supplier")}
                    selectedValues={columnFilters["supplier"] || []}
                    onUpdate={(values) =>
                      handleFilterUpdate("supplier", values)
                    }
                    dataTestId="filter-supplier"
                  />
                </div>
              </TableHead>
              <TableHead className="text-sm font-semibold p-1 md:p-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate max-w-[80px] md:max-w-none">
                    Покупатель
                  </span>
                  <TableColumnFilter
                    title="Покупатель"
                    options={getUniqueOptions("buyer")}
                    selectedValues={columnFilters["buyer"] || []}
                    onUpdate={(values) => handleFilterUpdate("buyer", values)}
                    dataTestId="filter-buyer"
                  />
                </div>
              </TableHead>
              <TableHead className="text-center text-sm font-semibold p-1 md:p-2 w-[50px]">
                Литры
              </TableHead>
              <TableHead className="text-center text-sm font-semibold p-1 md:p-2 w-[50px]">
                Плотн.
              </TableHead>
              <TableHead className="text-center text-sm font-semibold p-1 md:p-2 w-[60px]">
                КГ
              </TableHead>
              <TableHead className="text-right text-sm font-semibold p-1 md:p-2 w-[80px]">
                Цена пок.
              </TableHead>
              <TableHead className="text-right text-sm font-semibold p-1 md:p-2 w-[90px]">
                Покупка
              </TableHead>
              <TableHead className="text-right text-sm font-semibold p-1 md:p-2 w-[80px]">
                Цена прод.
              </TableHead>
              <TableHead className="text-right text-sm font-semibold p-1 md:p-2 w-[90px]">
                Продажа
              </TableHead>
              <TableHead className="text-right text-sm font-semibold p-1 md:p-2 w-[90px]">
                Прибыль
              </TableHead>
              <TableHead className="w-[40px] p-1"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={12}
                  className="text-center py-8 text-muted-foreground text-sm"
                >
                  Нет данных для отображения
                </TableCell>
              </TableRow>
            ) : (
              deals.map((deal: any) => (
                <TableRow
                  key={deal.id}
                  className={cn(
                    deal.isDraft &&
                      "bg-muted/70 opacity-60 border-2 border-orange-200",
                  )}
                >
                  <TableCell className="text-[10px] md:text-xs p-1 md:p-4">
                    <div className="flex flex-col gap-0.5">
                      <span>{formatDate(deal.refuelingDate)}</span>
                      {deal.isDraft && (
                        <Badge
                          variant="outline"
                          className="rounded-full bg-amber-100 px-1 py-0 text-[11px] text-amber-800 w-fit"
                        >
                          Черновик
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-[11px] md:text-sm p-1 md:p-4">
                    <Badge
                      variant="outline"
                      className={cn(
                        "whitespace-nowrap inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold",
                        deal.productType === PRODUCT_TYPE.KEROSENE
                          ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/30 dark:border-blue-800/30"
                          : deal.productType === PRODUCT_TYPE.PVKJ
                            ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/30 dark:border-purple-800/30"
                            : "",
                      )}
                    >
                      {getProductLabel(deal.productType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px] md:text-sm p-1 md:p-4">
                    {deal.aircraftNumber || "—"}
                  </TableCell>
                  <TableCell className="text-[11px] md:text-sm p-1 md:p-4">
                    <TooltipProvider>
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[80px] md:max-w-none">
                          {deal.supplier?.name || "Не указан"}
                        </span>
                        {deal.supplier?.isWarehouse && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Warehouse className="h-3.5 w-3.5 text-sky-400 flex-shrink-0 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Склад</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-[11px] md:text-sm p-1 md:p-4">
                    <span className="truncate max-w-[80px] md:max-w-none block">
                      {deal.buyer?.name || "Не указан"}
                    </span>
                  </TableCell>
                  <TableCell className="text-[11px] md:text-sm p-1 md:p-4">
                    <span className="truncate max-w-[50px] md:max-w-none block">
                      {formatNumberForTable(deal.quantityLiters) || "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-[11px] md:text-sm p-1 md:p-4">
                    <span className="truncate max-w-[50px] md:max-w-none block">
                      {deal.density || "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium text-[11px] md:text-sm p-1 md:p-4">
                    <TooltipProvider>
                      <div className="flex items-center justify-end gap-1">
                        <span>{formatNumberForTable(deal.quantityKg)}</span>
                        {deal.isApproxVolume && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="h-3.5 w-3.5 text-red-300 flex-shrink-0 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Примерный объем</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right text-[11px] md:text-sm p-1 md:p-4">
                    <div className="flex items-center justify-end gap-1">
                      {deal.purchasePrice
                        ? Number(deal.purchasePrice).toFixed(4)
                        : "-"}
                      {deal.purchasePriceModified && (
                        <span
                          className="text-orange-500"
                          title="Цена закупки была автоматически пересчитана"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-[11px] md:text-sm p-1 md:p-4">
                    {formatCurrencyForTable(deal.purchaseAmount)}
                  </TableCell>
                  <TableCell className="text-right text-[11px] md:text-sm p-1 md:p-4">
                    {formatNumber(deal.salePrice)} ₽/кг
                  </TableCell>
                  <TableCell className="text-right text-[11px] md:text-sm p-1 md:p-4">
                    {formatCurrencyForTable(deal.saleAmount)}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium text-[11px] md:text-sm p-1 md:p-4">
                    {formatCurrencyForTable(deal.profit)}
                  </TableCell>
                  <TableCell className="p-1">
                    <RefuelingDealActions
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full max-w-xs gap-2"
            data-testid="button-load-more-refueling"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка...
              </>
            ) : (
              "Загрузить еще"
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
        title="Удалить заправку?"
        description="Вы уверены, что хотите удалить эту заправку? Это действие нельзя отменить."
      />

      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Примечания к заправке</DialogTitle>
            <DialogDescription>
              {selectedDealNotes ? selectedDealNotes : "Нет примечаний"}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <AuditPanel
        open={deletedDealsAuditOpen}
        onOpenChange={setDeletedDealsAuditOpen}
        entityType="aircraft_refueling"
        entityId=""
        entityName="Все заправки ВС (включая удаленные)"
      />
    </div>
  );
}
