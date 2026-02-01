import { useState, useEffect, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Copy, Trash2, Loader2, Search, Filter, History } from "lucide-react";
import { formatCurrency, formatNumber } from "../utils";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { EntityActionsMenu } from "@/components/entity-actions-menu";
import { getProductLabel } from "../../refueling/utils";
import { PRODUCT_TYPE } from "@shared/constants";
import { useRefuelingAbroadTable } from "../hooks/use-refueling-abroad-table";
import { TableColumnFilter } from "@/components/ui/table-column-filter";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditPanel } from "@/components/audit-panel";
import { ExportButton } from "@/components/export/export-button";

interface RefuelingAbroadTableProps {
  onEdit: (item: any) => void;
  onCopy: (item: any) => void;
}

export function RefuelingAbroadTable({
  onEdit,
  onCopy,
}: RefuelingAbroadTableProps) {
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
    handleDelete,
  } = useRefuelingAbroadTable();

  const [deletedDealsAuditOpen, setDeletedDealsAuditOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput, setSearch]);

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });
  };

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
    setColumnFilters((prev) => ({
      ...prev,
      [columnId]: values,
    }));
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

  const items = refuelingDeals?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Поиск по поставщику, покупателю..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
            data-testid="input-search-refueling-abroad"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setColumnFilters({})}
          disabled={Object.values(columnFilters).every((v) => v.length === 0)}
          title="Сбросить все фильтры"
          className={cn(
            Object.values(columnFilters).some((v) => v.length > 0) &&
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
        <ExportButton module="refueling-abroad" />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[13px] font-semibold p-2 w-[100px]">
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
              <TableHead className="text-[13px] font-semibold p-2 w-[110px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Продукт</span>
                  <TableColumnFilter
                    title="Продукт"
                    options={getUniqueOptions("productType")}
                    selectedValues={columnFilters["productType"] || []}
                    onUpdate={(values) => handleFilterUpdate("productType", values)}
                    dataTestId="filter-product"
                  />
                </div>
              </TableHead>
              <TableHead className="text-[13px] font-semibold p-2">Аэроп. / Борт</TableHead>
              <TableHead className="text-[13px] font-semibold p-2">
                <div className="flex items-center justify-between gap-1">
                  <span>Поставщик</span>
                  <TableColumnFilter
                    title="Поставщик"
                    options={getUniqueOptions("supplier.name")}
                    selectedValues={columnFilters["supplier"] || []}
                    onUpdate={(values) => handleFilterUpdate("supplier", values)}
                    dataTestId="filter-supplier"
                  />
                </div>
              </TableHead>
              <TableHead className="text-[13px] font-semibold p-2">
                <div className="flex items-center justify-between gap-1">
                  <span>Покупатель</span>
                  <TableColumnFilter
                    title="Покупатель"
                    options={getUniqueOptions("buyer.name")}
                    selectedValues={columnFilters["buyer"] || []}
                    onUpdate={(values) => handleFilterUpdate("buyer", values)}
                    dataTestId="filter-buyer"
                  />
                </div>
              </TableHead>
              <TableHead className="text-center text-[13px] font-semibold p-2">Посредники</TableHead>
              <TableHead className="text-right text-[13px] font-semibold p-2 w-[100px]">Объем (Л / Пл / КГ)</TableHead>
              <TableHead className="text-right text-[13px] font-semibold p-2 w-[130px]">Закупка (Цена / Сумма)</TableHead>
              <TableHead className="text-right text-[13px] font-semibold p-2 w-[130px]">Продажа (Цена / Сумма)</TableHead>
              <TableHead className="text-right text-[13px] font-semibold p-2 w-[120px]">Комиссия / Прибыль</TableHead>
              <TableHead className="w-8 p-1"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                  Нет записей для отображения.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item: any) => (
                <TableRow
                  key={item.id}
                  className={cn(
                    item.isDraft &&
                      "bg-muted/70 opacity-60 border-2 border-orange-200",
                  )}
                >
                  <TableCell className="text-[10px] md:text-xs p-1 md:p-3">
                    <div className="flex flex-col gap-0.5">
                      <span>{formatDate(item.refuelingDate)}</span>
                      {item.isDraft && (
                        <Badge
                          variant="outline"
                          className="rounded-full bg-amber-100 px-1 py-0 text-[11px] text-amber-800 w-fit"
                        >
                          Черновик
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-[11px] md:text-sm p-1 md:p-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "whitespace-nowrap inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold",
                        item.productType === PRODUCT_TYPE.KEROSENE
                          ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/30 dark:border-blue-800/30"
                          : item.productType === PRODUCT_TYPE.PVKJ
                            ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/30 dark:border-purple-800/30"
                            : "",
                      )}
                    >
                      {getProductLabel(item.productType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="p-2">
                    <div className="flex flex-col">
                      <span className="font-mono">{item.airport || "—"}</span>
                      <span className="text-muted-foreground">{item.aircraftNumber || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="p-2">
                    <div className="flex flex-col max-w-[120px]">
                      <span className="truncate font-medium" title={item.supplier?.name}>
                        {item.supplier?.name || "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="p-2">
                    <div className="flex flex-col max-w-[120px]">
                      <span className="truncate font-medium" title={item.buyer?.name}>
                        {item.buyer?.name || "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="p-2">
                    <div className="flex flex-col gap-0.5 max-w-[180px]">
                      {item.intermediaries?.map((rel: any) => (
                        <div key={rel.id} className="text-[13px] leading-tight">
                          <span className="font-medium">{rel.intermediary?.name}</span>
                          <span className="ml-1 text-blue-500">
                            {formatCurrency(rel.commissionUsd, "USD")}
                          </span>
                        </div>
                      ))}
                      {(!item.intermediaries || item.intermediaries.length === 0) && "—"}
                    </div>
                  </TableCell>
                  <TableCell className="p-2 text-right">
                    <div className="flex flex-col font-mono">
                      <span className="text-muted-foreground">{formatNumber(item.quantityLiters)} л</span>
                      <span className="text-[10px] text-muted-foreground">ρ: {item.density || "—"}</span>
                      <span className="font-semibold">{formatNumber(item.quantityKg)} кг</span>
                    </div>
                  </TableCell>
                  <TableCell className="p-2 text-right">
                    <div className="flex flex-col font-mono">
                      <span>${formatNumber(item.purchasePriceUsd)}</span>
                      <span className="font-medium text-orange-600">
                        {formatCurrency(item.purchaseAmountUsd, "USD")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="p-2 text-right">
                    <div className="flex flex-col font-mono">
                      <span>${formatNumber(item.salePriceUsd)}</span>
                      <span className="font-medium text-orange-600">
                        {formatCurrency(item.saleAmountUsd, "USD")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="p-2 text-right">
                    <div className="flex flex-col font-mono">
                      <span className="text-blue-500">{formatCurrency(item.intermediaryCommissionUsd, "USD")}</span>
                      <span
                        className={cn(
                          "font-semibold",
                          parseFloat(item.profitUsd || "0") < 0
                            ? "text-destructive"
                            : "text-green-600"
                        )}
                      >
                        {formatCurrency(item.profitUsd, "USD")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="p-1">
                    <EntityActionsMenu
                      actions={[
                        {
                          id: "copy",
                          label: "Копировать",
                          icon: Copy,
                          onClick: () => onCopy(item),
                          permission: { module: "refueling", action: "create" },
                        },
                        {
                          id: "edit",
                          label: "Редактировать",
                          icon: Pencil,
                          onClick: () => onEdit(item),
                          permission: { module: "refueling", action: "edit" },
                        },
                        {
                          id: "delete",
                          label: "Удалить",
                          icon: Trash2,
                          onClick: () => setDeleteId(item.id),
                          variant: "destructive",
                          permission: { module: "refueling", action: "delete" },
                        },
                      ]}
                      audit={{
                        entityType: "aircraft_refueling_abroad",
                        entityId: item.id,
                        entityName: `Заправка за рубежом от ${formatDate(item.refuelingDate)}`,
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
            data-testid="button-load-more-refueling-abroad"
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Запись будет удалена из системы.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  handleDelete(deleteId);
                  setDeleteId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AuditPanel
        open={deletedDealsAuditOpen}
        onOpenChange={setDeletedDealsAuditOpen}
        entityType="aircraft_refueling_abroad"
        entityId=""
        entityName="Все заправки ВС Зарубеж (включая удаленные)"
      />
    </div>
  );
}
