import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { StatCell } from "@/components/ui/stat-cell";
import { useFilterReferenceData } from "@/hooks/use-filter-reference-data";

interface RefuelingDealActionsProps {
  deal: any;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
  permModule?: string;
}

function isCreatedToday(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const now = new Date();
  const d = new Date(createdAt);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
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
  /** Когда таблица открыта в fullscreen-диалоге, не ограничиваем высоту */
  isFullscreen?: boolean;
}

export function RefuelingTable({
  onEdit,
  onCopy,
  onDelete,
  onAdd,
  equipmentType = EQUIPMENT_TYPE.COMMON,
  isFullscreen = false,
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
  const [searchInput, setSearchInput] = useState(search);
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
        const fiveMin = 2 * 60 * 1000;
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

  // Справочники — кэшированные данные для фильтров
  const { data: allCustomers = [] } = useQuery<any[]>({ queryKey: ["/api/customers"], staleTime: 5 * 60 * 1000 });
  const { data: allBases = [] } = useQuery<any[]>({ queryKey: ["/api/bases"], staleTime: 5 * 60 * 1000 });

  // Только поставщики с базисами заправки + СЗ (средства заправки)
  const { refuelingSupplierOptions, equipmentOptions } = useFilterReferenceData({
    refuelingSuppliers: true,
    equipment: equipmentType === EQUIPMENT_TYPE.LIK,
  });

  const customerOptions = useMemo(() =>
    allCustomers.map((c: any) => ({ label: c.name, value: c.name })).sort((a: any, b: any) => a.label.localeCompare(b.label)), [allCustomers]);
  const basisOptions = useMemo(() =>
    allBases.map((b: any) => ({ label: b.name, value: b.name })).sort((a: any, b: any) => a.label.localeCompare(b.label)), [allBases]);

  // Генерируем опции для фильтров на основе данных (только для не-справочных столбцов)
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

  const allDeals = (refuelingDeals as any)?.data || [];
  const deals = allDeals;

  // Вычисляем принадлежность к группе РТ (Номер РТ + та же дата) для визуальной группировки
  const rtGroupInfo = useMemo(() => {
    const result = new Map<string, { isGrouped: boolean; isFirstInGroup: boolean; isLastInGroup: boolean; groupProfit: number | null }>();
    const computeForList = (dealList: any[]) => {
      // Собираем суммарную прибыль по каждой группе (orderNumber + date)
      const groupProfits = new Map<string, number>();
      dealList.forEach((deal) => {
        if (!deal.orderNumber) return;
        const key = `${deal.orderNumber}_${formatDate(deal.refuelingDate)}`;
        const p = deal.profit !== null && deal.profit !== undefined ? parseFloat(deal.profit) : 0;
        groupProfits.set(key, (groupProfits.get(key) ?? 0) + p);
      });
      dealList.forEach((deal, idx) => {
        if (!deal.orderNumber) {
          result.set(deal.id, { isGrouped: false, isFirstInGroup: false, isLastInGroup: false, groupProfit: null });
          return;
        }
        const sameDate = formatDate(deal.refuelingDate);
        const groupKey = `${deal.orderNumber}_${sameDate}`;
        const prev = idx > 0 ? dealList[idx - 1] : null;
        const next = idx < dealList.length - 1 ? dealList[idx + 1] : null;
        const prevSame = !!(prev && prev.orderNumber === deal.orderNumber && formatDate(prev.refuelingDate) === sameDate);
        const nextSame = !!(next && next.orderNumber === deal.orderNumber && formatDate(next.refuelingDate) === sameDate);
        const isGrouped = prevSame || nextSame;
        result.set(deal.id, {
          isGrouped,
          isFirstInGroup: isGrouped && !prevSame,
          isLastInGroup: isGrouped && !nextSame,
          groupProfit: isGrouped ? (groupProfits.get(groupKey) ?? null) : null,
        });
      });
    };
    computeForList(deals.filter((d: any) => isCreatedToday(d.createdAt)));
    computeForList(deals.filter((d: any) => !isCreatedToday(d.createdAt)));
    return result;
  }, [deals]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

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
        <ExportButton
          moduleName="refueling"
          exportFilters={{ search, columnFilters }}
          previewData={deals}
        />
      </div>

      <div className={cn("border rounded-lg overflow-auto", !isFullscreen && "max-h-[calc(100vh-250px)]")}>
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
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
                    isDateFilter
                  />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold p-1 bg-background">
                <div className="flex items-center justify-between gap-1">
                  <span>Прод.</span>
                  <TableColumnFilter
                    title="Продукт"
                    options={[
                      { label: getProductLabel(PRODUCT_TYPE.KEROSENE), value: PRODUCT_TYPE.KEROSENE },
                      { label: getProductLabel(PRODUCT_TYPE.PVKJ), value: PRODUCT_TYPE.PVKJ },
                      { label: getProductLabel(PRODUCT_TYPE.SERVICE), value: PRODUCT_TYPE.SERVICE },
                    ]}
                    selectedValues={columnFilters["productType"] || []}
                    onUpdate={(values) =>
                      handleFilterUpdate("productType", values)
                    }
                    dataTestId="filter-product"
                  />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold p-1 w-[55px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Борт</span>
                  <TableColumnFilter
                    title="Борт"
                    options={[]}
                    selectedValues={columnFilters["board"] || []}
                    onUpdate={(values) => handleFilterUpdate("board", values)}
                    onSearch={async (q) => {
                      const res = await fetch(`/api/refueling/filter-values?column=board&q=${encodeURIComponent(q)}&equipmentType=${equipmentType}`);
                      return res.json();
                    }}
                    dataTestId="filter-board"
                  />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold p-1 w-[80px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Номер РТ</span>
                  <TableColumnFilter
                    title="Номер РТ"
                    options={getUniqueOptions("orderNumber")}
                    selectedValues={columnFilters["orderNumber"] || []}
                    onUpdate={(values) => handleFilterUpdate("orderNumber", values)}
                    onSearch={async (q) => {
                      const res = await fetch(`/api/refueling/filter-values?column=orderNumber&q=${encodeURIComponent(q)}&equipmentType=${equipmentType}`);
                      return res.json();
                    }}
                    dataTestId="filter-order-number"
                  />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold p-1 w-[90px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Направ.</span>
                  <TableColumnFilter
                    title="Направление"
                    options={getUniqueOptions("flightNumber")}
                    selectedValues={columnFilters["direction"] || []}
                    onUpdate={(values) => handleFilterUpdate("direction", values)}
                    onSearch={async (q) => {
                      const res = await fetch(`/api/refueling/filter-values?column=direction&q=${encodeURIComponent(q)}&equipmentType=${equipmentType}`);
                      return res.json();
                    }}
                    dataTestId="filter-direction"
                  />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold p-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate max-w-[70px]">
                    Поставщик
                  </span>
                  <TableColumnFilter
                    title="Поставщик"
                    options={refuelingSupplierOptions}
                    selectedValues={columnFilters["supplier"] || []}
                    onUpdate={(values) =>
                      handleFilterUpdate("supplier", values)
                    }
                    dataTestId="filter-supplier"
                  />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold p-1 w-[65px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Базис</span>
                  <TableColumnFilter
                    title="Базис"
                    options={basisOptions}
                    selectedValues={columnFilters["basis"] || []}
                    onUpdate={(values) => handleFilterUpdate("basis", values)}
                    dataTestId="filter-basis"
                  />
                </div>
              </TableHead>
              {equipmentType === EQUIPMENT_TYPE.LIK && (
                <TableHead className="text-xs font-semibold p-1 w-[70px]">
                  <div className="flex items-center justify-between gap-1">
                    <span>СЗ</span>
                    <TableColumnFilter
                      title="СЗ"
                      options={equipmentOptions}
                      selectedValues={columnFilters["equipment"] || []}
                      onUpdate={(values) => handleFilterUpdate("equipment", values)}
                      dataTestId="filter-equipment"
                    />
                  </div>
                </TableHead>
              )}
              <TableHead className="text-xs font-semibold p-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate max-w-[70px]">
                    Покупатель
                  </span>
                  <TableColumnFilter
                    title="Покупатель"
                    options={customerOptions}
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
              <TableHead className="text-right text-xs font-semibold p-1 w-[90px]">
                Прочие усл.
              </TableHead>
              <TableHead className="text-right text-xs font-semibold p-1 w-[72px]">
                Прибыль
              </TableHead>
              <TableHead className="w-[10px] p-1 sticky right-0 bg-background z-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.length > 0 && (
              <TableRow className="bg-muted/30 hover:bg-muted/40 border-b-2">
                {/* Дата, Прод., Борт, Номер РТ, Направление, Поставщик, Базис */}
                <TableCell className="py-1 px-1" colSpan={7} />

                {/* СЗ - только для LIK */}
                {equipmentType === EQUIPMENT_TYPE.LIK && (
                  <TableCell className="py-1 px-1" />
                )}
                {/* Покупатель */}
                <TableCell className="py-1 px-1" />
                {/* Лит. */}
                <TableCell className="py-1 px-1">
                  <StatCell
                    values={deals.map((d: any) => d.quantityLiters)}
                    formatFn={(v) => formatNumberForTable(v)}
                  />
                </TableCell>
                {/* Пл. (плотность) — пропуск */}
                <TableCell className="py-1 px-1" />
                {/* КГ */}
                <TableCell className="py-1 px-1">
                  <StatCell
                    values={deals.map((d: any) => d.quantityKg)}
                    formatFn={(v) => formatNumberForTable(v)}
                  />
                </TableCell>
                {/* Цена пок. — пропуск */}
                <TableCell className="py-1 px-1" />
                {/* Покупка */}
                <TableCell className="py-1 px-1">
                  <StatCell
                    values={deals.map((d: any) => d.purchaseAmount)}
                    formatFn={(v) => formatCurrencyForTable(v)}
                  />
                </TableCell>
                {/* Цена пр. — пропуск */}
                <TableCell className="py-1 px-1" />
                {/* Продажа */}
                <TableCell className="py-1 px-1">
                  <StatCell
                    values={deals.map((d: any) => d.saleAmount)}
                    formatFn={(v) => formatCurrencyForTable(v)}
                  />
                </TableCell>
                {/* Прочие усл. */}
                <TableCell className="py-1 px-1">
                  <StatCell
                    values={deals.map((d: any) => {
                      const af = parseFloat(d.agentFee || "0");
                      const osf = parseFloat(d.otherServiceFee || "0");
                      return (isNaN(af) || d.isAgentFeeEnabled === false ? 0 : af) + (isNaN(osf) || d.isOtherServiceEnabled === false ? 0 : osf);
                    })}
                    formatFn={(v) => formatCurrencyForTable(v)}
                  />
                </TableCell>
                {/* Прибыль */}
                <TableCell className="py-1 px-1">
                  <StatCell
                    values={deals.map((d: any) => d.profit)}
                    formatFn={(v) => formatCurrencyForTable(v)}
                  />
                </TableCell>
                <TableCell className="py-1 px-1 sticky right-0 bg-muted/30" />
              </TableRow>
            )}
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
              (() => {
                const _todayDeals = deals.filter((d: any) => isCreatedToday(d.createdAt));
                const _olderDeals = deals.filter((d: any) => !isCreatedToday(d.createdAt));
                const _rows: any[] = [];
                if (_todayDeals.length > 0) {
                  _rows.push(
                    <TableRow key="__today_hdr" className="bg-emerald-50/70 dark:bg-emerald-950/20 border-y border-emerald-200/60 dark:border-emerald-800/40 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/20">
                      <TableCell colSpan={100} className="py-1.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Созданные сегодня</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }
                let _lastDateSep = '';
                const _renderDeal = (deal: any, isToday: boolean) => {
                  if (!isToday) {
                    const _ds = formatDate(deal.refuelingDate);
                    if (_ds !== _lastDateSep) {
                      _lastDateSep = _ds;
                      _rows.push(
                        <TableRow key={`__datesep_${_ds}_${deal.id}`} className="bg-muted/20 border-t hover:bg-muted/20">
                          <TableCell colSpan={100} className="py-0.5 px-5">
                            <span className="text-[11px] font-semibold text-muted-foreground">{_ds}</span>
                          </TableCell>
                        </TableRow>
                      );
                    }
                  }
                  const _gInfo = rtGroupInfo.get(deal.id) || { isGrouped: false, isFirstInGroup: false, isLastInGroup: false, groupProfit: null };
                  _rows.push((
                    <TableRow
                      key={deal.id}
                      className={cn(
                        isToday && !deal.isDraft && "bg-emerald-50/30 dark:bg-emerald-950/10",
                        deal.isDraft && "bg-muted/70 opacity-60 border-2 border-orange-200",
                        !deal.isDraft && lastCreatedDealId === deal.id && "new-deal-flash",
                        // Визуальная группировка по Номеру РТ — боковые и торцевые рамки
                        _gInfo.isGrouped && !deal.isDraft && !isToday && "bg-sky-50/20 dark:bg-sky-950/10",
                        _gInfo.isGrouped && !deal.isDraft && "border-l-2 border-r-2 border-l-sky-300/60 border-r-sky-300/60 dark:border-l-sky-700/50 dark:border-r-sky-700/50",
                        _gInfo.isFirstInGroup && !deal.isDraft && "border-t-2 border-t-sky-300/60 dark:border-t-sky-700/50",
                        _gInfo.isLastInGroup && !deal.isDraft && "border-b-0",
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
                    <span className="truncate max-w-[75px] block text-muted-foreground">
                      {deal.orderNumber || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs py-1.5 px-1">
                    <span className="truncate max-w-[85px] block text-muted-foreground">
                      {deal.flightNumber || "—"}
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
                        ? formatNumber(deal.purchasePrice)
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
                    {formatNumber(deal.salePrice)}
                  </TableCell>
                  <TableCell className="text-right text-xs py-1.5 px-1">
                    {formatCurrencyForTable(deal.saleAmount)}
                  </TableCell>
                  <TableCell className="text-right text-xs py-1.5 px-1">
                    {(() => {
                      const OTHER_TYPE_SHORT: Record<string, string> = {
                        royalty_per_ton: "Рой.",
                        percent_of_amount: "%",
                        fixed: "Фикс.",
                      };
                      const agentFeeVal = parseFloat(deal.agentFee || "0");
                      const otherFeeVal = parseFloat(deal.otherServiceFee || "0");
                      const hasAgent = !isNaN(agentFeeVal) && agentFeeVal > 0;
                      const hasOther = !isNaN(otherFeeVal) && otherFeeVal > 0;
                      if (!hasAgent && !hasOther) return <span className="text-muted-foreground">—</span>;
                      return (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col items-end gap-0.5 cursor-help">
                                {hasAgent && deal.isAgentFeeEnabled === true && (
                                  <span>
                                    Аг: {formatCurrencyForTable(agentFeeVal)}
                                  </span>
                                )}
                                {hasOther && deal.isOtherServiceEnabled === true && (
                                  <span>
                                    {deal.otherServiceType ? (OTHER_TYPE_SHORT[deal.otherServiceType] ?? "") : ""} {formatCurrencyForTable(otherFeeVal)}
                                  </span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              {hasAgent && <p>Агентское: {formatCurrencyForTable(agentFeeVal)}{deal.isAgentFeeEnabled === false ? " (выключено)" : ""}</p>}
                              {hasOther && <p>{deal.otherServiceName || "Прочая услуга"}: {formatCurrencyForTable(otherFeeVal)}{deal.isOtherServiceEnabled === false ? " (выключено)" : ""}</p>}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}
                  </TableCell>
                  <TableCell className={`text-right font-medium text-xs py-1.5 px-1 ${deal.profit !== null && parseFloat(deal.profit) < 0 ? "text-destructive" : "text-green-600"}`}>
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
                  ));
                  // Добавляем строку с суммарной прибылью группы после последней строки группы
                  if (_gInfo.isLastInGroup && !deal.isDraft && _gInfo.groupProfit !== null) {
                    const _gProfit = _gInfo.groupProfit!;
                    _rows.push((
                      <TableRow key={`rt-profit-${deal.id}`} className="border-l-2 border-r-2 border-b-2 border-l-sky-300/60 border-r-sky-300/60 border-b-sky-300/60 dark:border-l-sky-700/50 dark:border-r-sky-700/50 dark:border-b-sky-700/50 bg-sky-50/30 dark:bg-sky-950/15 hover:bg-sky-50/40">
                        <TableCell colSpan={100} className="py-0.5 px-2">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[10px] text-muted-foreground">Итого по РТ {deal.orderNumber}:</span>
                            <span className={`text-[11px] font-semibold ${_gProfit < 0 ? "text-destructive" : "text-green-600"}`}>
                              {formatCurrencyForTable(String(_gProfit))}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ));
                  }
                };
                _todayDeals.forEach((d: any) => _renderDeal(d, true));
                _olderDeals.forEach((d: any) => _renderDeal(d, false));
                return _rows;
              })()
            )}
          </TableBody>
        </Table>

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
      </div>

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
