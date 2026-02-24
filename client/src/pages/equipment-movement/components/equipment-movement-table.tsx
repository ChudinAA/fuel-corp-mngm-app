import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EntityActionsMenu } from "@/components/entity-actions-menu";
import { Pencil, Trash2, History, Filter, Search } from "lucide-react";
import { formatNumber, formatDate } from "../utils";
import { useEquipmentMovementTable } from "../hooks/use-equipment-movement-table";
import type { EquipmentMovementTableProps } from "../types";
import { useState } from "react";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/export/export-button";
import { cn } from "@/lib/utils";
import { PRODUCT_TYPE } from "@shared/constants";
import { ProductTypeBadge } from "@/components/product-type-badge";

export function EquipmentMovementTable({
  onEdit,
  onDelete,
  onShowHistory,
}: EquipmentMovementTableProps) {
  const { movements, isLoading } = useEquipmentMovementTable();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4 px-4 md:px-6 pb-5">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 md:px-6 pb-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          {/* <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Поиск..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div> */}
          {/* <Button
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
          </Button> */}
          <Button
            variant="outline"
            onClick={onShowHistory}
            title="Аудит всех перемещений"
          >
            <History className="h-4 w-4 mr-2" />
            История изменений
          </Button>
          <ExportButton moduleName="equipment-movement" />
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Продукт</TableHead>
              <TableHead>Откуда</TableHead>
              <TableHead>Куда</TableHead>
              <TableHead className="text-right">КГ</TableHead>
              <TableHead className="text-right">Себест.</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  Нет данных
                </TableCell>
              </TableRow>
            ) : (
              movements.map((item: any) => (
                <TableRow
                  key={item.id}
                  className={cn(
                    "hover:bg-muted/50 transition-colors",
                    item.isDraft &&
                      "bg-muted/70 opacity-60 border-2 border-orange-200",
                  )}
                >
                  <TableCell className="text-[12px] md:text-xs py-2 px-1 md:px-2 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      {item?.movementDate ? formatDate(item.movementDate) : "—"}
                      {item.isDraft && (
                        <Badge
                          variant="secondary"
                          className="w-fit text-[9px] h-4 px-1 bg-yellow-100 text-yellow-800 border-yellow-200"
                        >
                          Черновик
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ProductTypeBadge
                      type={item?.productType || PRODUCT_TYPE.KEROSENE}
                    />
                  </TableCell>
                  <TableCell>
                    {item?.fromEquipmentName || item?.fromWarehouseName || "—"}
                  </TableCell>
                  <TableCell>
                    {item?.toEquipmentName || item?.toWarehouseName || "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(item?.quantityKg)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(item?.costPerKg)}
                  </TableCell>
                  <TableCell>
                    <EntityActionsMenu
                      actions={[
                        {
                          id: "edit",
                          label: "Редактировать",
                          icon: Pencil,
                          onClick: () => onEdit(item),
                        },
                        {
                          id: "delete",
                          label: "Удалить",
                          icon: Trash2,
                          onClick: () => setDeleteId(item.id),
                          variant: "destructive",
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <DeleteConfirmDialog
          open={!!deleteId}
          onOpenChange={(open) => !open && setDeleteId(null)}
          onConfirm={() => {
            if (deleteId) {
              onDelete(deleteId);
              setDeleteId(null);
            }
          }}
          title="Удалить перемещение?"
          description="Это действие нельзя будет отменить. Данные о топливе на складах и ТЗА будут пересчитаны автоматически."
        />
      </div>
    </div>
  );
}
