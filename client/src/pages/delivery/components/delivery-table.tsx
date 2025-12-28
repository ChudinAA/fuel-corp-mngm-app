import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Truck, Pencil, Trash2, Droplets, Fuel, Warehouse, MapPin } from "lucide-react";
import { AuditHistoryButton } from "@/components/audit-history-button";
import { EntityActionsMenu, EntityAction } from "@/components/entity-actions-menu";
import type { DeliveryCost } from "@shared/schema";
import { formatNumber } from "../utils";
import { BASE_TYPE, DELIVERY_ENTITY_TYPE } from "@shared/constants";

interface DeliveryTableProps {
  costs: DeliveryCost[];
  isLoading: boolean;
  getCarrierName: (carrierId: string) => string;
  onEdit: (cost: DeliveryCost) => void;
  bases?: any[];
}

export function DeliveryTable({ costs, isLoading, getCarrierName, onEdit, bases = [] }: DeliveryTableProps) {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [costToDelete, setCostToDelete] = useState<DeliveryCost | null>(null);

  const getEntityIcon = (entityType: string, entityId: string) => {
    switch (entityType) {
      case DELIVERY_ENTITY_TYPE.BASE:
        const base = bases.find(b => b.id === entityId);
        if (base?.baseType === BASE_TYPE.REFUELING) {
          return { icon: Fuel, color: "text-green-400", label: "Базис (Заправка)" };
        }
        return { icon: Droplets, color: "text-orange-400", label: "Базис (ОПТ)" };
      case DELIVERY_ENTITY_TYPE.WAREHOUSE:
        return { icon: Warehouse, color: "text-sky-400", label: "Склад" };
      case DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION:
        return { icon: MapPin, color: "text-purple-400", label: "Место доставки" };
      default:
        return { icon: MapPin, color: "text-gray-400", label: "Неизвестно" };
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/delivery-costs/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-costs"] });
      toast({ title: "Тариф удален", description: "Запись успешно удалена" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить тариф", variant: "destructive" });
    },
  });

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Перевозчик</TableHead>
            <TableHead>Маршрут</TableHead>
            <TableHead className="text-right">За кг (₽)</TableHead>
            <TableHead className="text-right">Расстояние (км)</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            ))
          ) : costs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Нет тарифов для отображения
              </TableCell>
            </TableRow>
          ) : (
            costs.map((cost) => {
              const fromEntityIcon = getEntityIcon(cost.fromEntityType, cost.fromEntityId);
              const toEntityIcon = getEntityIcon(cost.toEntityType, cost.toEntityId);
              const FromIcon = fromEntityIcon.icon;
              const ToIcon = toEntityIcon.icon;

              const hasActions = hasPermission("delivery", "edit") || hasPermission("delivery", "delete");

              return (
                <TableRow key={cost.id}>
                  <TableCell>{getCarrierName(cost.carrierId)}</TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <FromIcon className={`h-3.5 w-3.5 ${fromEntityIcon.color}`} />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{fromEntityIcon.label}</p>
                            </TooltipContent>
                          </Tooltip>
                          <span>{cost.fromLocation}</span>
                        </div>
                        <span className="text-muted-foreground">→</span>
                        <div className="flex items-center gap-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <ToIcon className={`h-3.5 w-3.5 ${toEntityIcon.color}`} />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{toEntityIcon.label}</p>
                            </TooltipContent>
                          </Tooltip>
                          <span>{cost.toLocation}</span>
                        </div>
                      </div>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatNumber(cost.costPerKg)} ₽</TableCell>
                <TableCell className="text-right">{cost.distance ? formatNumber(cost.distance) : "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-green-600 border-green-600">Активен</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <AuditHistoryButton
                        entityType="delivery"
                        entityId={cost.id}
                        entityName={`${cost.fromLocation} → ${cost.toLocation}`}
                        variant="ghost"
                        size="icon"
                      />
                      <EntityActionsMenu
                        actions={[
                          {
                            id: "edit",
                            label: "Редактировать",
                            icon: Pencil,
                            onClick: () => onEdit(cost),
                            permission: { module: "delivery", action: "edit" },
                          },
                          {
                            id: "delete",
                            label: "Удалить",
                            icon: Trash2,
                            onClick: () => {
                              setCostToDelete(cost);
                              setDeleteDialogOpen(true);
                            },
                            variant: "destructive" as const,
                            permission: { module: "delivery", action: "delete" },
                          },
                        ]}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (costToDelete) {
            deleteMutation.mutate(costToDelete.id);
          }
          setDeleteDialogOpen(false);
          setCostToDelete(null);
        }}
        title="Удалить тариф?"
        description="Вы уверены, что хотите удалить этот тариф доставки? Это действие нельзя отменить."
      />
    </div>
  );
}