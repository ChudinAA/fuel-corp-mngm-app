import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Copy, Trash2, Loader2 } from "lucide-react";
import { formatCurrency, formatNumber } from "../utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RefuelingAbroad, Supplier, Customer } from "@shared/schema";
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
import { EntityActionsMenu, EntityAction } from "@/components/entity-actions-menu";
import { getProductLabel } from "../../refueling/utils";
import { PRODUCT_TYPE } from "@shared/constants";

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

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/refueling-abroad"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/refueling-abroad/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/refueling-abroad"] });
      toast({ title: "Запись удалена" });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить запись",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Нет записей. Создайте первую заправку за рубежом.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Дата</TableHead>
            <TableHead>Продукт</TableHead>
            <TableHead>Аэропорт</TableHead>
            <TableHead>Борт</TableHead>
            <TableHead>Поставщик</TableHead>
            <TableHead>Покупатель</TableHead>
            <TableHead>Посредники</TableHead>
            <TableHead className="text-right">Литры</TableHead>
            <TableHead className="text-right">Плотн.</TableHead>
            <TableHead className="text-right">КГ</TableHead>
            <TableHead className="text-right">Цена пок.</TableHead>
            <TableHead className="text-right">Покупка</TableHead>
            <TableHead className="text-right">Цена прод.</TableHead>
            <TableHead className="text-right">Продажа</TableHead>
            <TableHead className="text-right">Комиссии</TableHead>
            <TableHead className="text-right">Прибыль</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.id}
              className={cn(
                item.isDraft &&
                  "bg-muted/70 opacity-60 border-2 border-orange-200",
              )}
            >
              <TableCell className="text-[10px] md:text-xs p-1 md:p-4">
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
              <TableCell>
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
              <TableCell className="font-mono">{item.airport || "—"}</TableCell>
              <TableCell>{item.aircraftNumber || "—"}</TableCell>
              <TableCell>{item.supplier?.name || "—"}</TableCell>
              <TableCell>{item.buyer?.name || "—"}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {item.intermediaries?.map((rel: any) => (
                    <div key={rel.id} className="text-[10px] whitespace-nowrap">
                      <span className="font-medium">{rel.intermediary?.name}</span>
                      <span className="text-muted-foreground ml-1">
                        ({formatCurrency(rel.commissionUsd, "USD")})
                      </span>
                    </div>
                  ))}
                  {(!item.intermediaries || item.intermediaries.length === 0) && "—"}
                </div>
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatNumber(item.quantityLiters)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {item.density || "—"}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatNumber(item.quantityKg)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatNumber(item.purchasePriceUsd)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(item.purchaseAmountUsd, "USD")}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatNumber(item.salePriceUsd)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(item.saleAmountUsd, "USD")}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(item.intermediaryCommissionUsd, "USD")}
              </TableCell>
              <TableCell className="text-right font-mono">
                <span
                  className={
                    parseFloat(item.profitUsd || "0") < 0
                      ? "text-destructive"
                      : "text-green-600"
                  }
                >
                  {formatCurrency(item.profitUsd, "USD")}
                </span>
              </TableCell>
              <TableCell>
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
          ))}
        </TableBody>
      </Table>

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
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
