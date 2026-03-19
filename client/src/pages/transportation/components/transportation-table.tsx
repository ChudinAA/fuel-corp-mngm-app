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
import { Pencil, Trash2, Search, FileText, History, Copy, Loader2 } from "lucide-react";
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
import { formatNumberForTable, formatCurrencyForTable, getProductLabel } from "@/pages/opt/utils";
import { useTransportationTable } from "../hooks/use-transportation-table";
import { EntityActionsMenu, EntityAction } from "@/components/entity-actions-menu";
import { AuditPanel } from "@/components/audit-panel";
import { ExportButton } from "@/components/export/export-button";
import { Badge } from "@/components/ui/badge";
import { TableColumnFilter } from "@/components/ui/table-column-filter";
import { ProductTypeBadge } from "@/components/product-type-badge";
import { TRANSPORTATION_TABLE_COLUMNS, DEFAULT_TRANSPORTATION_COLUMNS } from "../constants";

interface TransportationTableProps {
  onEdit: (item: any) => void;
  onCopy: (item: any) => void;
}

export function TransportationTable({ onEdit, onCopy }: TransportationTableProps) {
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
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_TRANSPORTATION_COLUMNS);
  const loaderRef = useRef<HTMLDivElement | null>(null);

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
    return () => { if (el) observer.unobserve(el); };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const getFilterOptions = (columnId: string): string[] => {
    const all = transportationDeals?.pages.flatMap((p) => p.data) || [];
    switch (columnId) {
      case "date":
        return [...new Set(all.map((d) => d.dealDate ? format(new Date(d.dealDate), "dd.MM.yyyy", { locale: ru }) : ""))].filter(Boolean);
      case "supplier":
        return [...new Set(all.map((d) => d.supplier?.name || ""))].filter(Boolean);
      case "buyer":
        return [...new Set(all.map((d) => d.buyer?.name || ""))].filter(Boolean);
      case "carrier":
        return [...new Set(all.map((d) => d.carrier?.name || ""))].filter(Boolean);
      case "deliveryLocation":
        return [...new Set(all.map((d) => d.deliveryLocation?.name || ""))].filter(Boolean);
      case "productType":
        return [...new Set(all.map((d) => d.productType || ""))].filter(Boolean);
      default:
        return [];
    }
  };

  const isColumnVisible = (id: string) => visibleColumns.includes(id);

  const exportData = allDeals.map((d) => ({
    "Дата": d.dealDate ? format(new Date(d.dealDate), "dd.MM.yyyy") : "",
    "Поставщик": d.supplier?.name || "",
    "Покупатель": d.buyer?.name || "",
    "Базис погрузки": d.basis || "",
    "Базис доставки": d.customerBasis || "",
    "Перевозчик": d.carrier?.name || "",
    "Пункт доставки": d.deliveryLocation?.name || "",
    "Продукт": getProductLabel(d.productType),
    "Кг": d.quantityKg || "",
    "Цена покупки": d.purchasePrice || "",
    "Цена продажи": d.salePrice || "",
    "Сумма покупки": d.purchaseAmount || "",
    "Сумма продажи": d.saleAmount || "",
    "Стоимость доставки": d.deliveryCost || "",
    "Прибыль": d.profit || "",
    "Примечание": d.notes || "",
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
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <ExportButton data={exportData} filename="transportation" />
        <div className="text-sm text-muted-foreground">
          Всего: {totalCount}
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {TRANSPORTATION_TABLE_COLUMNS.filter((c) => isColumnVisible(c.id)).map((col) => (
                <TableHead key={col.id} className="whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    {col.label}
                    {["date", "supplier", "buyer", "carrier", "deliveryLocation", "productType"].includes(col.id) && (
                      <TableColumnFilter
                        columnId={col.id}
                        options={getFilterOptions(col.id)}
                        selectedValues={columnFilters[col.id] || []}
                        onChange={(vals) =>
                          setColumnFilters((prev) => ({ ...prev, [col.id]: vals }))
                        }
                      />
                    )}
                  </div>
                </TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {allDeals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + 1} className="text-center text-muted-foreground py-8">
                  Нет данных
                </TableCell>
              </TableRow>
            ) : (
              allDeals.map((deal) => (
                <TableRow
                  key={deal.id}
                  className={cn(
                    deal.isDraft ? "opacity-60 italic" : "",
                    "cursor-pointer hover-elevate",
                  )}
                  data-testid={`row-transportation-${deal.id}`}
                  onClick={() => onEdit(deal)}
                >
                  {isColumnVisible("date") && (
                    <TableCell className="whitespace-nowrap">
                      {deal.dealDate
                        ? format(new Date(deal.dealDate), "dd.MM.yyyy", { locale: ru })
                        : "—"}
                      {deal.isDraft && (
                        <Badge variant="secondary" className="ml-1 text-xs">
                          Черновик
                        </Badge>
                      )}
                    </TableCell>
                  )}
                  {isColumnVisible("supplier") && (
                    <TableCell>{deal.supplier?.name || "—"}</TableCell>
                  )}
                  {isColumnVisible("buyer") && (
                    <TableCell>{deal.buyer?.name || "—"}</TableCell>
                  )}
                  {isColumnVisible("basis") && (
                    <TableCell>{deal.basis || "—"}</TableCell>
                  )}
                  {isColumnVisible("customerBasis") && (
                    <TableCell>{deal.customerBasis || "—"}</TableCell>
                  )}
                  {isColumnVisible("carrier") && (
                    <TableCell>{deal.carrier?.name || "—"}</TableCell>
                  )}
                  {isColumnVisible("deliveryLocation") && (
                    <TableCell>{deal.deliveryLocation?.name || "—"}</TableCell>
                  )}
                  {isColumnVisible("productType") && (
                    <TableCell>
                      <ProductTypeBadge type={deal.productType} />
                    </TableCell>
                  )}
                  {isColumnVisible("quantityKg") && (
                    <TableCell className="text-right whitespace-nowrap">
                      {formatNumberForTable(deal.quantityKg)}
                    </TableCell>
                  )}
                  {isColumnVisible("purchasePrice") && (
                    <TableCell className="text-right whitespace-nowrap">
                      {formatNumberForTable(deal.purchasePrice)}
                    </TableCell>
                  )}
                  {isColumnVisible("salePrice") && (
                    <TableCell className="text-right whitespace-nowrap">
                      {formatNumberForTable(deal.salePrice)}
                    </TableCell>
                  )}
                  {isColumnVisible("purchaseAmount") && (
                    <TableCell className="text-right whitespace-nowrap">
                      {formatCurrencyForTable(deal.purchaseAmount)}
                    </TableCell>
                  )}
                  {isColumnVisible("saleAmount") && (
                    <TableCell className="text-right whitespace-nowrap">
                      {formatCurrencyForTable(deal.saleAmount)}
                    </TableCell>
                  )}
                  {isColumnVisible("deliveryCost") && (
                    <TableCell className="text-right whitespace-nowrap">
                      {formatCurrencyForTable(deal.deliveryCost)}
                    </TableCell>
                  )}
                  {isColumnVisible("profit") && (
                    <TableCell
                      className={cn(
                        "text-right whitespace-nowrap",
                        deal.profit !== null && parseFloat(deal.profit) >= 0
                          ? "text-green-600"
                          : "text-red-600",
                      )}
                    >
                      {formatCurrencyForTable(deal.profit)}
                    </TableCell>
                  )}
                  {isColumnVisible("notes") && (
                    <TableCell className="max-w-[150px] truncate">
                      {deal.notes || "—"}
                    </TableCell>
                  )}
                  <TableCell onClick={(e) => e.stopPropagation()}>
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
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            handleDelete(deleteId);
            setDeleteId(null);
          }
        }}
        title="Удалить перевозку?"
        description="Это действие нельзя отменить. Запись будет помечена как удалённая."
        isLoading={deleteMutation.isPending}
      />

      {auditItemId && (
        <Dialog open={!!auditItemId} onOpenChange={() => setAuditItemId(null)}>
          <DialogContent className="sm:max-w-[750px] h-[70vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>История изменений</DialogTitle>
              <DialogDescription>Все изменения этой записи</DialogDescription>
            </DialogHeader>
            <AuditPanel entityType="transportation" entityId={auditItemId} />
          </DialogContent>
        </Dialog>
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
    </div>
  );
}
