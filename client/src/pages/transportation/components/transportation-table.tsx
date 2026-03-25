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
  FileText,
  History,
  Copy,
  Loader2,
  Filter,
  Plus,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
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
import {
  formatNumberForTable,
  formatCurrencyForTable,
  getProductLabel,
} from "@/pages/opt/utils";
import { useTransportationTable } from "../hooks/use-transportation-table";
import {
  EntityActionsMenu,
  EntityAction,
} from "@/components/entity-actions-menu";
import { AuditPanel } from "@/components/audit-panel";
import { ExportButton } from "@/components/export/export-button";
import { Badge } from "@/components/ui/badge";
import { TableColumnFilter } from "@/components/ui/table-column-filter";
import { ProductTypeBadge } from "@/components/product-type-badge";
import {
  TRANSPORTATION_TABLE_COLUMNS,
  DEFAULT_TRANSPORTATION_COLUMNS,
} from "../constants";

interface TransportationTableProps {
  onEdit: (item: any) => void;
  onCopy: (item: any) => void;
  onCreate?: () => void;
}

export function TransportationTable({
  onEdit,
  onCopy,
  onCreate,
}: TransportationTableProps) {
  const { hasPermission } = useAuth();
  const {
    search,
    setSearch,
    pageSize,
    transportationDeals,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    columnFilters,
    setColumnFilters,
    handleDelete,
    deleteMutation,
  } = useTransportationTable();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [auditItemId, setAuditItemId] = useState<string | null>(null);
  const [notesItem, setNotesItem] = useState<any | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    DEFAULT_TRANSPORTATION_COLUMNS,
  );
  const [deletedDealsAuditOpen, setDeletedDealsAuditOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 500);
    return () => clearTimeout(timer);
  }, [searchInput, setSearch]);

  const allDeals = useMemo(
    () => transportationDeals?.pages.flatMap((p) => p.data) || [],
    [transportationDeals],
  );

  const totalCount = transportationDeals?.pages[0]?.total || 0;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.5 },
    );
    const el = loaderRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const getFilterOptions = (
    columnId: string,
  ): { label: string; value: string }[] => {
    const all = transportationDeals?.pages.flatMap((p) => p.data) || [];
    switch (columnId) {
      case "date": {
        const vals = [
          ...new Set(
            all.map((d) =>
              d.dealDate
                ? format(new Date(d.dealDate), "dd.MM.yyyy", { locale: ru })
                : "",
            ),
          ),
        ].filter(Boolean);
        return vals.map((v) => ({ label: v, value: v }));
      }
      case "supplier": {
        const vals = [
          ...new Set(all.map((d) => d.supplier?.name || "")),
        ].filter(Boolean);
        return vals.map((v) => ({ label: v, value: v }));
      }
      case "buyer": {
        const vals = [...new Set(all.map((d) => d.buyer?.name || ""))].filter(
          Boolean,
        );
        return vals.map((v) => ({ label: v, value: v }));
      }
      case "carrier": {
        const vals = [...new Set(all.map((d) => d.carrier?.name || ""))].filter(
          Boolean,
        );
        return vals.map((v) => ({ label: v, value: v }));
      }
      case "deliveryLocation": {
        const vals = [
          ...new Set(all.map((d) => d.deliveryLocation?.name || "")),
        ].filter(Boolean);
        return vals.map((v) => ({ label: v, value: v }));
      }
      case "productType": {
        const vals = [...new Set(all.map((d) => d.productType || ""))].filter(
          Boolean,
        );
        return vals.map((v) => ({ label: getProductLabel(v), value: v }));
      }
      default:
        return [];
    }
  };

  const isColumnVisible = (id: string) => visibleColumns.includes(id);

  const exportData = allDeals.map((d) => ({
    Дата: d.dealDate ? format(new Date(d.dealDate), "dd.MM.yyyy") : "",
    Поставщик: d.supplier?.name || "",
    Покупатель: d.buyer?.name || "",
    "Базис погрузки": d.basis || "",
    "Базис доставки": d.customerBasis || "",
    Перевозчик: d.carrier?.name || "",
    "Пункт доставки": d.deliveryLocation?.name || "",
    Продукт: getProductLabel(d.productType),
    Кг: d.quantityKg || "",
    "Цена покупки": d.purchasePrice || "",
    "Цена продажи": d.salePrice || "",
    "Сумма покупки": d.purchaseAmount || "",
    "Сумма продажи": d.saleAmount || "",
    "Стоимость доставки": d.deliveryCost || "",
    Прибыль: d.profit || "",
    Примечание: d.notes || "",
  }));

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {onCreate && hasPermission("opt", "create") && (
          <Button onClick={onCreate} data-testid="button-add-transportation">
            <Plus className="mr-2 h-4 w-4" />
            Новая перевозка
          </Button>
        )}
        <div className="relative flex-1 min-w-[160px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Поиск по поставщику, покупателю..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setColumnFilters({})}
          disabled={Object.values(columnFilters).every(
            (v: any) => !v || v.length === 0,
          )}
          title="Сбросить все фильтры"
          className={cn(
            Object.values(columnFilters).some((v: any) => v && v.length > 0) &&
              "text-primary border-primary",
          )}
        >
          <Filter className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={() => setDeletedDealsAuditOpen(true)}
          title="История всех изменений"
        >
          <History className="h-4 w-4 mr-2" />
          История
        </Button>
        <ExportButton data={exportData} filename="transportation" />
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {TRANSPORTATION_TABLE_COLUMNS.filter((c) =>
                isColumnVisible(c.id),
              ).map((col) => (
                <TableHead key={col.id} className="text-xs font-semibold px-1 py-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate max-w-[80px]">{col.label}</span>
                    {[
                      "date",
                      "supplier",
                      "buyer",
                      "carrier",
                      "deliveryLocation",
                      "productType",
                    ].includes(col.id) && (
                      <TableColumnFilter
                        title={col.label}
                        options={getFilterOptions(col.id)}
                        selectedValues={columnFilters[col.id] || []}
                        onUpdate={(vals) =>
                          setColumnFilters((prev) => ({
                            ...prev,
                            [col.id]: vals,
                          }))
                        }
                      />
                    )}
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-[10px] px-1 py-1 sticky right-0 bg-background z-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {allDeals.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + 1}
                  className="text-center text-muted-foreground text-xs py-8"
                >
                  Нет данных
                </TableCell>
              </TableRow>
            ) : (
              allDeals.map((deal) => (
                <TableRow
                  key={deal.id}
                  className={cn(
                    deal.isDraft &&
                      "bg-muted/70 opacity-60 border-2 border-orange-200",
                    "cursor-pointer hover-elevate",
                  )}
                  data-testid={`row-transportation-${deal.id}`}
                  onClick={() => onEdit(deal)}
                >
                  {isColumnVisible("date") && (
                    <TableCell className="text-[10px] py-1.5 px-1 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span>
                          {deal.dealDate
                            ? format(new Date(deal.dealDate), "dd.MM.yyyy", {
                                locale: ru,
                              })
                            : "—"}
                        </span>
                        {deal.isDraft && (
                          <Badge
                            variant="secondary"
                            className="w-fit text-[9px] h-4 px-1 bg-yellow-100 text-yellow-800 border-yellow-200"
                          >
                            Черновик
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {isColumnVisible("supplier") && (
                    <TableCell className="text-xs py-1.5 px-1 max-w-[100px]">
                      <span className="truncate block">{deal.supplier?.name || "—"}</span>
                    </TableCell>
                  )}
                  {isColumnVisible("buyer") && (
                    <TableCell className="text-xs py-1.5 px-1 max-w-[100px]">
                      <span className="truncate block">{deal.buyer?.name || "—"}</span>
                    </TableCell>
                  )}
                  {isColumnVisible("basis") && (
                    <TableCell className="text-xs py-1.5 px-1 max-w-[80px]">
                      <span className="truncate block">{deal.basis || "—"}</span>
                    </TableCell>
                  )}
                  {isColumnVisible("customerBasis") && (
                    <TableCell className="text-xs py-1.5 px-1 max-w-[80px]">
                      <span className="truncate block">{deal.customerBasis || "—"}</span>
                    </TableCell>
                  )}
                  {isColumnVisible("carrier") && (
                    <TableCell className="text-xs py-1.5 px-1 max-w-[90px]">
                      <span className="truncate block">{deal.carrier?.name || "—"}</span>
                    </TableCell>
                  )}
                  {isColumnVisible("deliveryLocation") && (
                    <TableCell className="text-xs py-1.5 px-1 max-w-[90px]">
                      <span className="truncate block">{deal.deliveryLocation?.name || "—"}</span>
                    </TableCell>
                  )}
                  {isColumnVisible("productType") && (
                    <TableCell className="py-1.5 px-1">
                      <ProductTypeBadge type={deal.productType} />
                    </TableCell>
                  )}
                  {isColumnVisible("quantityKg") && (
                    <TableCell className="text-right text-xs py-1.5 px-1">
                      {formatNumberForTable(deal.quantityKg)}
                    </TableCell>
                  )}
                  {isColumnVisible("purchasePrice") && (
                    <TableCell className="text-right text-xs py-1.5 px-1">
                      {formatNumberForTable(deal.purchasePrice)}
                    </TableCell>
                  )}
                  {isColumnVisible("salePrice") && (
                    <TableCell className="text-right text-xs py-1.5 px-1">
                      {formatNumberForTable(deal.salePrice)}
                    </TableCell>
                  )}
                  {isColumnVisible("purchaseAmount") && (
                    <TableCell className="text-right text-xs py-1.5 px-1">
                      {formatCurrencyForTable(deal.purchaseAmount)}
                    </TableCell>
                  )}
                  {isColumnVisible("saleAmount") && (
                    <TableCell className="text-right text-xs py-1.5 px-1">
                      {formatCurrencyForTable(deal.saleAmount)}
                    </TableCell>
                  )}
                  {isColumnVisible("deliveryCost") && (
                    <TableCell className="text-right text-xs py-1.5 px-1">
                      {formatCurrencyForTable(deal.deliveryCost)}
                    </TableCell>
                  )}
                  {isColumnVisible("profit") && (
                    <TableCell
                      className={cn(
                        "text-right text-xs py-1.5 px-1",
                        deal.profit !== null && parseFloat(deal.profit) >= 0
                          ? "text-green-600"
                          : "text-red-600",
                      )}
                    >
                      {formatCurrencyForTable(deal.profit)}
                    </TableCell>
                  )}
                  {isColumnVisible("notes") && (
                    <TableCell className="text-xs py-1.5 px-1 max-w-[100px] truncate">
                      {deal.notes || "—"}
                    </TableCell>
                  )}
                  <TableCell onClick={(e) => e.stopPropagation()} className="py-1.5 px-1 sticky right-0 bg-background">
                    <EntityActionsMenu
                      actions={[
                        ...(deal.notes
                          ? [
                              {
                                id: "notes",
                                label: "Примечания",
                                icon: FileText,
                                onClick: () => setNotesItem(deal),
                              } as EntityAction,
                            ]
                          : []),
                        {
                          id: "copy",
                          label: "Создать копию",
                          icon: Copy,
                          onClick: () => onCopy(deal),
                          permission: { module: "opt", action: "create" },
                        },
                        {
                          id: "audit",
                          label: "История изменений",
                          icon: History,
                          onClick: () => setAuditItemId(deal.id),
                        },
                        {
                          id: "edit",
                          label: "Редактировать",
                          icon: Pencil,
                          onClick: () => onEdit(deal),
                          permission: { module: "opt", action: "edit" },
                        },
                        {
                          id: "delete",
                          label: "Удалить",
                          icon: Trash2,
                          onClick: () => setDeleteId(deal.id),
                          variant: "destructive" as const,
                          permission: { module: "opt", action: "delete" },
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div ref={loaderRef} className="flex justify-center py-2">
        {isFetchingNextPage && (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        )}
      </div>

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            handleDelete(deleteId);
            setDeleteId(null);
          }
        }}
        title="Удалить перевозку?"
        description="Это действие нельзя отменить. Запись будет помечена как удалённая."
      />

      {auditItemId && (
        <AuditPanel
          open={!!auditItemId}
          onOpenChange={() => setAuditItemId(null)}
          entityType="transportation"
          entityId={auditItemId}
          entityName="Все изменения этой записи"
        />
      )}

      {notesItem && (
        <Dialog open={!!notesItem} onOpenChange={() => setNotesItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Примечание</DialogTitle>
            </DialogHeader>
            <p className="whitespace-pre-wrap">{notesItem.notes}</p>
          </DialogContent>
        </Dialog>
      )}

      <AuditPanel
        open={deletedDealsAuditOpen}
        onOpenChange={setDeletedDealsAuditOpen}
        entityType="transportation"
        entityId=""
        entityName="Все перевозки (включая удалённые)"
      />
    </div>
  );
}
