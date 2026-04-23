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
  TriangleAlert,
  Search,
  Filter,
  Warehouse,
  History,
  Copy,
  Loader2,
  Truck,
  Plus,
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
import { EQUIPMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { useAuth } from "@/hooks/use-auth";
import { AuditPanel } from "@/components/audit-panel";
import { ExportButton } from "@/components/export/export-button";
import { cn } from "@/lib/utils";

import { TableColumnFilter } from "@/components/ui/table-column-filter";
import { ProductTypeBadge } from "@/components/product-type-badge";

interface RefuelingDealActionsProps {
  deal: any;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
  permModule?: string;
}

function RefuelingDealActions({
  deal,
  onEdit,
  onCopy,
  onDelete,
  permModule = "refueling",
}: RefuelingDealActionsProps) {
  const actions: EntityAction[] = [
    {
      id: "copy",
      label: "Создать копию",
      icon: Copy,
      onClick: onCopy,
      permission: { module: permModule, action: "create" },
    },
    {
      id: "edit",
      label: "Редактировать",
      icon: Pencil,
      onClick: onEdit,
      permission: { module: permModule, action: "edit" },
    },
    {
      id: "delete",
      label: "Удалить",
      icon: Trash2,
      onClick: onDelete,
      variant: "destructive" as const,
      permission: { module: permModule, action: "delete" },
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
  onAdd?: () => void;
  equipmentType?: string;
}

export function RefuelingTable({
  onEdit,
  onCopy,
  onDelete,
  onAdd,
  equipmentType = EQUIPMENT_TYPE.COMMON,
}: RefuelingTableProps) {
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const { hasPermission } = useAuth();
  const permModule = equipmentType === EQUIPMENT_TYPE.LIK ? "lik-refueling" : "refueling";
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
  } = useRefuelingTable({ equipmentType }) as any;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<any>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedDealNotes, setSelectedDealNotes] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cursorPositionRef = useRef<number>(0);
  const [deletedDealsAuditOpen, setDeletedDealsAuditOpen] = useState(false);
  const [lastCreatedDealId, setLastCreatedDealId] = useState<string | null>(null);

  useEffect(() => {
    const lsKey = equipmentType === EQUIPMENT_TYPE.LIK ? "lastCreatedDeal_lik" : "lastCreatedDeal_refueling";
    const dealType = equipmentType === EQUIPMENT_TYPE.LIK ? "lik" : "refueling";
    let clearTimer: ReturnType<typeof setTimeout> | null = null;

    const checkAndApply = () => {
      try {
        const raw = localStorage.getItem(lsKey);
        if (!raw) { setLastCreatedDealId(null); return; }
        const { id, timestamp } = JSON.parse(raw);
        const elapsed = Date.now() - timestamp;
        const fiveMin = 5 * 60 * 1000;
        if (elapsed < fiveMin) {
          setLastCreatedDealId(id);
          if (clearTimer) clearTimeout(clearTimer);
          const remaining = fiveMin - elapsed;
          clearTimer = setTimeout(() => { setLastCreatedDealId(null); localStorage.removeItem(lsKey); }, remaining);
        } else {
          localStorage.removeItem(lsKey);
          setLastCreatedDealId(null);
        }
      } catch { setLastCreatedDealId(null); }
    };

    const onDealCreated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === dealType) checkAndApply();
    };

    checkAndApply();
    window.addEventListener("dealCreated", onDealCreated);
    return () => {
      window.removeEventListener("dealCreated", onDealCreated);
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [equipmentType]);

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
      <div className="flex items-center gap-2 flex-wrap">
        {onAdd && hasPermission(permModule, "create") && (
          <Button onClick={onAdd} data-testid="button-add-refueling">
            <Plus className="mr-2 h-4 w-4" />
            Новая заправка
          </Button>
        )}
        <div className="relative flex-1 min-w-[160px] max-w-sm">
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
          История
        </Button>
        <ExportButton module="refueling" />
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold p-1 w-[80px]">
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
              <TableHead className="text-xs font-semibold p-1">
                <div className="flex items-center justify-between gap-1">
                  <span>Прод.</span>
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
              <TableHead className="text-xs font-semibold p-1 w-[55px]">
                Борт
              </TableHead>
              <TableHead className="text-xs font-semibold p-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate max-w-[70px]">
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
              <TableHead className="text-xs font-semibold p-1 w-[65px]">
                Базис
              </TableHead>
              {equipmentType === EQUIPMENT_TYPE.LIK && (
                <TableHead className="text-xs font-semibold p-1 w-[70px]">
                  СЗ
                </TableHead>
              )}
              <TableHead className="text-xs font-semibold p-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate max-w-[70px]">
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
              <TableHead className="text-right text-xs font-semibold p-1 w-[50px]">
                Лит.
              </TableHead>
              <TableHead className="text-right text-xs font-semibold p-1 w-[45px]">
                Пл.
              </TableHead>
              <TableHead className="text-right text-xs font-semibold p-1 w-[55px]">
                КГ
              </TableHead>
              <TableHead className="text-right text-xs font-semibold p-1 w-[68px]">
                Цена пок.
              </TableHead>
              <TableHead className="text-right text-xs font-semibold p-1 w-[72px]">
                Покупка
              </TableHead>
              <TableHead className="text-right text-xs font-semibold p-1 w-[68px]">
                Цена пр.
              </TableHead>
              <TableHead className="text-right text-xs font-semibold p-1 w-[72px]">
                Продажа
              </TableHead>
              <TableHead className="text-right text-xs font-semibold p-1 w-[72px]">
                Прибыль
              </TableHead>
              <TableHead className="w-[10px] p-1 sticky right-0 bg-background z-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={12}
                  className="text-center py-8 text-muted-foreground text-xs"
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
                    !deal.isDraft && lastCreatedDealId === deal.id && "new-deal-flash",
                  )}
                >
                  <TableCell className="text-[10px] py-1.5 px-1">
                    <div className="flex flex-col gap-0.5">
                      <span>{formatDate(deal.refuelingDate)}</span>
                      {deal.isDraft && (
                        <Badge
                          variant="secondary"
                          className="w-fit text-[9px] h-4 px-1 bg-yellow-100 text-yellow-800 border-yellow-200"
                        >
                          Черновик
                        </Badge>
                      )}
                      {!deal.isDraft && deal.isPlannedDeal && (
                        <Badge
                          variant="secondary"
                          className="w-fit text-[9px] h-4 px-1 bg-blue-100 text-blue-700 border-blue-200"
                        >
                          Планируемая
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-1.5 px-1">
                    <ProductTypeBadge type={deal.productType} />
                  </TableCell>
                  <TableCell className="text-xs py-1.5 px-1">
                    <span className="truncate max-w-[50px] block">
                      {deal.aircraftNumber || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs py-1.5 px-1">
                    <TooltipProvider>
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[80px] block">
                          {deal.supplier?.name || "Не указан"}
                        </span>
                        {deal.supplier?.isWarehouse && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Warehouse className="h-3 w-3 text-sky-400 flex-shrink-0 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Склад</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell
                    className="text-xs py-1.5 px-1"
                    data-testid={`text-basis-${deal.id}`}
                  >
                    <span className="truncate max-w-[60px] block text-muted-foreground">
                      {deal.basis?.name || "—"}
                    </span>
                  </TableCell>
                  {equipmentType === EQUIPMENT_TYPE.LIK && (
                    <TableCell className="text-xs py-1.5 px-1">
                      <TooltipProvider>
                        <div className="flex items-center gap-1">
                          <span className="truncate max-w-[65px] block">
                            {deal.equipment?.name || "—"}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Truck className="h-3 w-3 text-orange-400 flex-shrink-0 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>СЗ</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  )}
                  <TableCell className="text-xs py-1.5 px-1">
                    <span className="truncate max-w-[80px] block">
                      {deal.buyer?.name || "Не указан"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs py-1.5 px-1">
                    {formatNumberForTable(deal.quantityLiters) || "-"}
                  </TableCell>
                  <TableCell className="text-right text-xs py-1.5 px-1">
                    {deal.density || "-"}
                  </TableCell>
                  <TableCell className="text-right font-medium text-xs py-1.5 px-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn(deal.isApproxVolume && "approx-volume-animated cursor-help")}>
                            {formatNumberForTable(deal.quantityKg)}
                          </span>
                        </TooltipTrigger>
                        {deal.isApproxVolume && (
                          <TooltipContent>
                            <p>Примерный объем (требует уточнения)</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right text-xs py-1.5 px-1">
                    <div className="flex items-center justify-end gap-1">
                      {deal.purchasePrice
                        ? Number(deal.purchasePrice).toFixed(4)
                        : "-"}
                      {deal.purchasePriceModified && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <TriangleAlert className="h-3 w-3 text-orange-500 flex-shrink-0 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Цена закупки была автоматически пересчитана</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs py-1.5 px-1">
                    {formatCurrencyForTable(deal.purchaseAmount)}
                  </TableCell>
                  <TableCell className="text-right text-xs py-1.5 px-1">
                    {formatNumber(deal.salePrice)} ₽/кг
                  </TableCell>
                  <TableCell className="text-right text-xs py-1.5 px-1">
                    {formatCurrencyForTable(deal.saleAmount)}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium text-xs py-1.5 px-1">
                    {formatCurrencyForTable(deal.profit)}
                  </TableCell>
                  <TableCell className="p-1 sticky right-0 bg-background">
                    {((equipmentType === EQUIPMENT_TYPE.COMMON &&
                      !deal.equipmentId) ||
                      equipmentType === EQUIPMENT_TYPE.LIK) && (
                      <RefuelingDealActions
                        deal={deal}
                        onEdit={() => onEdit(deal)}
                        onCopy={() => onCopy(deal)}
                        onDelete={() => {
                          setDealToDelete(deal);
                          setDeleteDialogOpen(true);
                        }}
                        permModule={permModule}
                      />
                    )}
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
