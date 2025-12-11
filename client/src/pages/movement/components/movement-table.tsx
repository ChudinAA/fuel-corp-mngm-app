
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2 } from "lucide-react";
import { formatNumber, formatCurrency, formatDate } from "../utils";
import type { MovementTableProps } from "../types";

export function MovementTable({ data, isLoading, onEdit, onDelete, isDeleting }: MovementTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Дата</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Откуда</TableHead>
            <TableHead>Куда</TableHead>
            <TableHead className="text-right">КГ</TableHead>
            <TableHead className="text-right">Стоимость</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3].map((i) => (
            <TableRow key={i}>
              <TableCell colSpan={7}>
                <Skeleton className="h-8 w-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (data.length === 0) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Дата</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Откуда</TableHead>
            <TableHead>Куда</TableHead>
            <TableHead className="text-right">КГ</TableHead>
            <TableHead className="text-right">Стоимость</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
              Нет данных
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Дата</TableHead>
          <TableHead>Тип</TableHead>
          <TableHead>Откуда</TableHead>
          <TableHead>Куда</TableHead>
          <TableHead className="text-right">КГ</TableHead>
          <TableHead className="text-right">Стоимость</TableHead>
          <TableHead className="w-[80px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{formatDate(item.movementDate)}</TableCell>
            <TableCell>
              <Badge variant="outline">
                {item.movementType === "supply" ? "Поставка" : "Внутреннее"}
              </Badge>
            </TableCell>
            <TableCell>{(item as any).fromName || "—"}</TableCell>
            <TableCell>{(item as any).toName || item.toWarehouseId}</TableCell>
            <TableCell className="text-right font-medium">{formatNumber(item.quantityKg)}</TableCell>
            <TableCell className="text-right">{formatCurrency(item.totalCost)}</TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  data-testid={`button-edit-movement-${item.id}`}
                  onClick={() => onEdit(item)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-destructive"
                  onClick={() => {
                    setItemToDelete(item);
                    setDeleteDialogOpen(true);
                  }}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (itemToDelete) {
            onDelete(itemToDelete.id);
          }
          setDeleteDialogOpen(false);
          setItemToDelete(null);
        }}
        title="Удалить перемещение?"
        description="Вы уверены, что хотите удалить это перемещение? Это действие нельзя отменить."
      />
    </Table>
  );
}
