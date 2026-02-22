import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EntityActionsMenu } from "@/components/entity-actions-menu";
import { Pencil, Trash2, History } from "lucide-react";
import { formatNumber, formatDate } from "../utils";
import { useEquipmentMovementTable } from "../hooks/use-equipment-movement-table";
import type { EquipmentMovementTableProps } from "../types";
import { useState } from "react";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";

export function EquipmentMovementTable({
  onEdit,
  onDelete,
  onShowHistory,
}: EquipmentMovementTableProps) {
  const { movements, isLoading } = useEquipmentMovementTable();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (isLoading) return <div>Загрузка...</div>;

  return (
    <div className="border rounded-lg">
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
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap">
                  {item?.movementDate ? formatDate(item.movementDate) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {item?.productType === "pvkj" ||
                    item?.productType === "PVKJ"
                      ? "ПВКЖ"
                      : "Керосин"}
                  </Badge>
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
  );
}
