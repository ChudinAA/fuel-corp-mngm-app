import { useState, useEffect, useRef, useMemo } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Search,
  Filter,
  Warehouse,
  FileText,
  AlertCircle,
  History,
  Copy,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { formatNumberForTable, formatCurrencyForTable } from "../utils";
import { useOptTable } from "../hooks/use-opt-table";
import {
  EntityActionsMenu,
  EntityAction,
} from "@/components/entity-actions-menu";
import { AuditPanel } from "@/components/audit-panel";
import { ExportButton } from "@/components/export/export-button";
import { Badge } from "@/components/ui/badge";
import { TableColumnFilter } from "@/components/ui/table-column-filter";

interface OptTableProps {
  onEdit: (opt: any) => void;
  onCopy: (opt: any) => void;
  onDelete?: () => void;
  onAdd?: () => void;
}

interface OptDealActionsProps {
  deal: any;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onShowNotes?: () => void;
}

function OptDealActions({
  deal,
  onEdit,
  onCopy,
  onDelete,
  onShowNotes,
}: OptDealActionsProps) {
  const actions: EntityAction[] = [
    ...(deal.notes && onShowNotes
      ? [
          {
            id: "notes",
            label: "Примечания",
            icon: FileText,
            onClick: onShowNotes,
          },
        ]
      : []),
    {
      id: "copy",
      label: "Создать копию",
      icon: Copy,
      onClick: onCopy,
      permission: { module: "opt", action: "create" },
    },
    {
      id: "edit",
      label: "Редактировать",
      icon: Pencil,
      onClick: onEdit,
      permission: { module: "opt", action: "edit" },
    },
    {
      id: "delete",
      label: "Удалить",
      icon: Trash2,
      onClick: onDelete,
      variant: "destructive" as const,
      permission: { module: "opt", action: "delete" },
      separatorAfter: true,
    },
  ];

  return (
    <EntityActionsMenu
      actions={actions}
      audit={{
        entityType: "opt",
        entityId: deal.id,
        entityName: `Сделка от ${new Date(deal.dealDate).toLocaleDateString("ru-RU")}`,
      }}
    />
  );
}

export function OptTable({ onEdit, onCopy, onDelete, onAdd }: OptTableProps) {
  const {
    search,
    setSearch,
    pageSize,
    optDeals,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    columnFilters,
    setColumnFilters,
    deleteMutation,
    handleDelete,
  } = useOptTable() as any;

  const deals = useMemo(() => optDeals?.pages.flatMap((page: any) => page.data) || [], [optDeals]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<any>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedDealNotes, setSelectedDealNotes] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cursorPositionRef = useRef<number>(0);
  const [deletedDealsAuditOpen, setDeletedDealsAuditOpen] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput, setSearch]);

  // Restore focus and cursor position after data update
  useEffect(() => {
    if (searchInputRef.current && searchInput) {
      const input = searchInputRef.current;
      input.focus();
      input.setSelectionRange(
        cursorPositionRef.current,
        cursorPositionRef.current,
      );
    }
  }, [optDeals]);

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });
  };

  const formatDateForAudit = (dateStr: string) => {
    return format(new Date(dateStr), "dd.MM.yyyy HH:mm:ss", { locale: ru });
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

  // Генерируем опции для фильтров на основе данных
  const getUniqueOptions = (key: string) => {
    const values = new Set<string>();
    deals.forEach((deal: any) => {
      let val;
      if (key === 'dealDate') {
        val = formatDate(deal.dealDate);
      } else if (key.includes('.')) {
        val = key.split('.').reduce((obj, k) => obj?.[k], deal);
      } else {
        val = deal[key];
      }

      const label = typeof val === 'object' ? val?.name : val;
      if (label) values.add(label);
    });
    return Array.from(values).sort().map(v => ({ label: v, value: v }));
  };
  
  const handleFilterUpdate = (columnId: string, values: string[]) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnId]: values
    }));
  };
  
  const dealsToDisplay = deals;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Поиск по поставщику, покупателю, базису..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              cursorPositionRef.current = e.target.selectionStart || 0;
            }}
            className="pl-9"
            data-testid="input-search-opt"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setColumnFilters({})}
          disabled={Object.values(columnFilters).every((v: any) => v.length === 0)}
          title="Сбросить все фильтры"
          className={cn(Object.values(columnFilters).some((v: any) => v.length > 0) && "text-primary border-primary")}
        >
          <Filter className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={() => setDeletedDealsAuditOpen(true)}
          title="Аудит всех сделок"
        >
          <History className="h-4 w-4 mr-2" />
          История изменений
        </Button>
        <ExportButton moduleName="opt" /> {/* Export button added here */}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-sm font-semibold p-1 md:p-2 w-[100px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Дата</span>
                  <TableColumnFilter
                    title="Дата"
                    options={getUniqueOptions("dealDate")}
                    selectedValues={columnFilters["date"] || []}
                    onUpdate={(values) => handleFilterUpdate("date", values)}
                    dataTestId="filter-date"
                  />
                </div>
              </TableHead>
              <TableHead className="text-sm font-semibold p-1 md:p-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate max-w-[80px] md:max-w-none">Поставщик</span>
                  <TableColumnFilter
                    title="Поставщик"
                    options={getUniqueOptions("supplier")}
                    selectedValues={columnFilters["supplier"] || []}
                    onUpdate={(values) => handleFilterUpdate("supplier", values)}
                    dataTestId="filter-supplier"
                  />
                </div>
              </TableHead>
              <TableHead className="text-sm font-semibold p-1 md:p-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate max-w-[80px] md:max-w-none">Покупатель</span>
                  <TableColumnFilter
                    title="Покупатель"
                    options={getUniqueOptions("buyer")}
                    selectedValues={columnFilters["buyer"] || []}
                    onUpdate={(values) => handleFilterUpdate("buyer", values)}
                    dataTestId="filter-buyer"
                  />
                </div>
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
              <TableHead className="text-sm font-semibold p-1 md:p-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate max-w-[80px] md:max-w-none">Доставка</span>
                  <TableColumnFilter
                    title="Место доставки"
                    options={getUniqueOptions("deliveryLocation")}
                    selectedValues={columnFilters["deliveryLocation"] || []}
                    onUpdate={(values) => handleFilterUpdate("deliveryLocation", values)}
                    dataTestId="filter-location"
                  />
                </div>
              </TableHead>
              <TableHead className="text-sm font-semibold p-1 md:p-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate max-w-[80px] md:max-w-none">Перевозчик</span>
                  <TableColumnFilter
                    title="Перевозчик"
                    options={getUniqueOptions("carrier")}
                    selectedValues={columnFilters["carrier"] || []}
                    onUpdate={(values) => handleFilterUpdate("carrier", values)}
                    dataTestId="filter-carrier"
                  />
                </div>
              </TableHead>
              <TableHead className="text-right text-sm font-semibold p-1 md:p-2 w-[90px]">
                Доставка
              </TableHead>
              <TableHead className="text-right text-sm font-semibold p-1 md:p-2 w-[90px]">
                Прибыль
              </TableHead>
              <TableHead className="w-[40px] p-1"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dealsToDisplay.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={14}
                  className="text-center py-8 text-muted-foreground text-sm"
                >
                  Нет данных для отображения
                </TableCell>
              </TableRow>
            ) : (
              dealsToDisplay.map((deal: any) => (
                <TableRow
                  key={deal.id}
                  className={cn(deal.isDraft && "bg-muted/70 opacity-60 border-2 border-orange-200")}
                >
                  <TableCell className="text-[10px] md:text-xs p-1 md:p-4">
                    <div className="flex flex-col gap-0.5">
                      <span>{formatDate(deal.dealDate)}</span>
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
                    <TooltipProvider>
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[80px] md:max-w-none">{deal.supplier?.name || "Не указан"}</span>
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
                    <span className="truncate max-w-[80px] md:max-w-none block">{deal.buyer?.name || "Не указан"}</span>
                  </TableCell>
                  <TableCell className="text-right font-medium text-[11px] md:text-sm p-1 md:p-2">
                    <TooltipProvider>
                      <div className="flex items-center justify-end gap-1">
                        <span>{formatNumberForTable(deal.quantityKg)}</span>
                        {deal.isApproxVolume && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="h-3.5 w-3.5Ле text-red-300 flex-shrink-0 cursor-help" />
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
                    {formatNumberForTable(deal.salePrice)}
                  </TableCell>
                  <TableCell className="text-right text-[11px] md:text-sm p-1 md:p-4">
                    {formatCurrencyForTable(deal.saleAmount)}
                  </TableCell>
                  <TableCell className="text-[11px] md:text-sm p-1 md:p-4">
                    <span className="truncate max-w-[100px] md:max-w-none block">{deal.deliveryLocation?.name || "—"}</span>
                  </TableCell>
                  <TableCell className="text-[11px] md:text-sm p-1 md:p-2">
                    <span className="truncate max-w-[100px] md:max-w-none block">{deal.carrier?.name || "—"}</span>
                  </TableCell>
                  <TableCell className="text-right text-[11px] md:text-sm p-1 md:p-4">
                    {deal.deliveryCost
                      ? formatCurrencyForTable(deal.deliveryCost)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium text-[11px] md:text-sm p-1 md:p-4">
                    {formatCurrencyForTable(deal.profit)}
                  </TableCell>
                  <TableCell className="p-1">
                    <OptDealActions
                      deal={deal}
                      onEdit={() => onEdit(deal)}
                      onCopy={() => onCopy(deal)}
                      onDelete={() => {
                        setDealToDelete(deal);
                        setDeleteDialogOpen(true);
                      }}
                      onShowNotes={
                        deal.notes
                          ? () => {
                              setSelectedDealNotes(deal.notes || "");
                              setNotesDialogOpen(true);
                            }
                          : undefined
                      }
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
            data-testid="button-load-more-opt"
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
        title="Удалить сделку?"
        description="Вы уверены, что хотите удалить эту оптовую сделку? Это действие нельзя отменить."
      />

      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Примечания к сделке</DialogTitle>
            <DialogDescription>
              {selectedDealNotes ? selectedDealNotes : "Нет примечаний"}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <AuditPanel
        open={deletedDealsAuditOpen}
        onOpenChange={setDeletedDealsAuditOpen}
        entityType="opt"
        entityId=""
        entityName="Все сделки ОПТ (включая удаленные)"
      />
    </div>
  );
}
