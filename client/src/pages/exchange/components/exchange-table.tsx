import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2 } from "lucide-react";
import type { ExchangeTableProps } from "../types";
import { formatNumber, formatCurrency, formatDate } from "../utils";
import { PRODUCT_TYPE } from "@shared/constants";
import { useAuth } from "@/hooks/use-auth";

export function ExchangeTable({
  data,
  isLoading,
  onEdit,
  onDelete,
  isDeletingId
}: ExchangeTableProps) {
  const { user } = useAuth();
  const canEdit = user?.permissions?.includes("exchange:edit");
  const canDelete = user?.permissions?.includes("exchange:delete");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Дата</TableHead>
            <TableHead>Номер</TableHead>
            <TableHead>Контрагент</TableHead>
            <TableHead>Продукт</TableHead>
            <TableHead className="text-right">КГ</TableHead>
            <TableHead className="text-right">Цена</TableHead>
            <TableHead className="text-right">Сумма</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <TableRow key={i}>
                <TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell>
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                Нет данных для отображения
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{formatDate(item.dealDate)}</TableCell>
                <TableCell>{item.dealNumber || "—"}</TableCell>
                <TableCell>{item.counterparty}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {item.productType === PRODUCT_TYPE.KEROSENE ? "Керосин" : "ПВКЖ"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">{formatNumber(item.quantityKg)}</TableCell>
                <TableCell className="text-right">{formatNumber(item.pricePerKg)} ₽</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(item.totalAmount)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        data-testid={`button-edit-exchange-${item.id}`}
                        onClick={() => onEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          setItemToDelete(item);
                          setDeleteDialogOpen(true);
                        }}
                        disabled={isDeletingId === item.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
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
          title="Удалить сделку?"
          description="Вы уверены, что хотите удалить эту биржевую сделку? Это действие нельзя отменить."
        />
      </Table>
    </div>
  );
}