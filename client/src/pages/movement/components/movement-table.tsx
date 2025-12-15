import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatNumber, formatCurrency, formatDate } from "../utils";

const formatNumberWithK = (value: string | number) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}к`;
  }
  return formatNumber(num);
};
import type { MovementTableProps } from "../types";

export function MovementTable({ data, isLoading, onEdit, onDelete, isDeleting }: MovementTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState("");

  const getProductLabel = (productType: string) => {
    if (productType === "pvkj") return "ПВКЖ";
    return "Керосин";
  };

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Дата</TableHead>
            <TableHead className="w-[110px]">Тип</TableHead>
            <TableHead className="w-[100px]">Продукт</TableHead>
            <TableHead className="min-w-[140px]">Откуда</TableHead>
            <TableHead className="min-w-[140px]">Куда</TableHead>
            <TableHead className="text-right">КГ</TableHead>
            <TableHead className="text-right">Цена покупки</TableHead>
            <TableHead className="text-right min-w-[120px]">Сумма покупки</TableHead>
            <TableHead>Перевозчик</TableHead>
            <TableHead className="text-right w-[100px]">Доставка</TableHead>
            <TableHead className="text-right w-[100px]">Хранение</TableHead>
            <TableHead className="text-right">Себестоимость</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3].map((i) => (
            <TableRow key={i}>
              <TableCell colSpan={13}>
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
            <TableHead className="w-[100px]">Дата</TableHead>
            <TableHead className="w-[110px]">Тип</TableHead>
            <TableHead className="w-[100px]">Продукт</TableHead>
            <TableHead className="min-w-[140px]">Откуда</TableHead>
            <TableHead className="min-w-[140px]">Куда</TableHead>
            <TableHead className="text-right">КГ</TableHead>
            <TableHead className="text-right">Цена покупки</TableHead>
            <TableHead className="text-right min-w-[120px]">Сумма покупки</TableHead>
            <TableHead>Перевозчик</TableHead>
            <TableHead className="text-right w-[100px]">Доставка</TableHead>
            <TableHead className="text-right w-[100px]">Хранение</TableHead>
            <TableHead className="text-right">Себестоимость</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
              Нет данных
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Дата</TableHead>
            <TableHead className="w-[110px]">Тип</TableHead>
            <TableHead className="w-[100px]">Продукт</TableHead>
            <TableHead className="min-w-[140px]">Откуда</TableHead>
            <TableHead className="min-w-[140px]">Куда</TableHead>
            <TableHead className="text-right">КГ</TableHead>
            <TableHead className="text-right">Цена покупки</TableHead>
            <TableHead className="text-right min-w-[120px]">Сумма покупки</TableHead>
            <TableHead>Перевозчик</TableHead>
            <TableHead className="text-right w-[100px]">Доставка</TableHead>
            <TableHead className="text-right w-[100px]">Хранение</TableHead>
            <TableHead className="text-right">Себестоимость</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => {
            const quantityKg = parseFloat(item.quantityKg || "0");
            const purchasePrice = item.purchasePrice ? parseFloat(item.purchasePrice) : null;
            const purchaseAmount = purchasePrice && quantityKg > 0 ? purchasePrice * quantityKg : 0;
            const deliveryCost = item.deliveryCost ? parseFloat(item.deliveryCost) : 0;
            const storageCost = (parseFloat(item.totalCost || "0") - purchaseAmount - deliveryCost);
            const costPerKg = item.costPerKg ? parseFloat(item.costPerKg) : 0;

            return (
              <TableRow key={item.id}>
                <TableCell>{formatDate(item.movementDate)}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {item.movementType === "supply" ? "Поставка" : "Внутреннее"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={item.productType === "pvkj" ? "secondary" : "outline"}>
                    {getProductLabel(item.productType || "kerosene")}
                  </Badge>
                </TableCell>
                <TableCell>{(item as any).fromName || "—"}</TableCell>
                <TableCell>{(item as any).toName || item.toWarehouseId}</TableCell>
                <TableCell className="text-right font-medium">{formatNumberWithK(item.quantityKg)}</TableCell>
                <TableCell className="text-right">
                  {purchasePrice !== null ? `${formatNumber(purchasePrice)} ₽/кг` : "—"}
                </TableCell>
                <TableCell className="text-right">{formatNumberWithK(purchaseAmount)}</TableCell>
                <TableCell>{(item as any).carrierName || "—"}</TableCell>
                <TableCell className="text-right">{formatNumberWithK(deliveryCost)}</TableCell>
                <TableCell className="text-right">{formatNumberWithK(storageCost)}</TableCell>
                <TableCell className="text-right font-medium">{formatNumber(costPerKg)} ₽/кг</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(item)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Редактировать
                      </DropdownMenuItem>
                      {item.notes && (
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedNotes(item.notes || "");
                            setNotesDialogOpen(true);
                          }}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Примечание
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          setItemToDelete(item);
                          setDeleteDialogOpen(true);
                        }}
                        disabled={isDeleting}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

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

      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Примечание</DialogTitle>
            <DialogDescription className="whitespace-pre-wrap">{selectedNotes}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}