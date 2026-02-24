import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Pencil, Trash2, Truck } from "lucide-react";
import { EntityActionsMenu } from "@/components/entity-actions-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Equipment } from "@shared/schema";
import { formatNumber, formatCurrency } from "../../warehouses/utils";
import { useAuth } from "@/hooks/use-auth";
import { ProductTypeBadge } from "@/components/product-type-badge";
import { PRODUCT_TYPE } from "@shared/constants";

interface EquipmentCardProps {
  equipment: Equipment;
  onEdit: (equipment: Equipment) => void;
  onViewDetails: (equipment: Equipment) => void;
  isLinked?: boolean;
  warehouseId?: string;
}

export function EquipmentCard({
  equipment,
  onEdit,
  onViewDetails,
  isLinked = false,
  warehouseId,
}: EquipmentCardProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const balance = parseFloat(equipment.currentBalance || "0");
  const cost = parseFloat(equipment.averageCost || "0");
  const pvkjBalance = parseFloat(equipment.pvkjBalance || "0");
  const pvkjCost = parseFloat(equipment.pvkjAverageCost || "0");
  const isInactive = equipment.isActive === "false";
  const { hasPermission } = useAuth();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/warehouses-equipment/${id}`);
      return res.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/warehouses-equipment"],
      });
      if (warehouseId) {
        queryClient.invalidateQueries({
          queryKey: [`/api/warehouses/${warehouseId}/equipment`],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/warehouses/equipment-map"],
        });
      }
      toast({
        title: "Оборудование удалено",
        description: "Запись успешно удалена",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить оборудование",
        variant: "destructive",
      });
    },
  });

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
        isLinked ? "border-l-orange-400 ml-4" : "border-l-sky-400"
      } ${isInactive ? "opacity-60" : ""}`}
      onClick={() => onViewDetails(equipment)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck
                className={`h-4 w-4 ${isLinked ? "text-orange-400" : "text-sky-400"}`}
              />
              {equipment.name}
              {isInactive && <Badge variant="destructive">Неактивен</Badge>}
              {isLinked && (
                <Badge variant="outline" className="text-[10px]">
                  ТЗК
                </Badge>
              )}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <div onClick={(e) => e.stopPropagation()}>
              <EntityActionsMenu
                actions={[
                  {
                    id: "edit",
                    label: "Редактировать",
                    icon: Pencil,
                    onClick: () => onEdit(equipment),
                    permission: { module: "refueling", action: "edit" },
                  },
                  {
                    id: "delete",
                    label: "Удалить",
                    icon: Trash2,
                    onClick: () => setDeleteDialogOpen(true),
                    variant: "destructive" as const,
                    permission: { module: "refueling", action: "delete" },
                  },
                ]}
                audit={{
                  entityType: "equipment",
                  entityId: equipment.id,
                  entityName: equipment.name,
                }}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold">
              {formatNumber(balance)} кг
            </span>
            <ProductTypeBadge type={PRODUCT_TYPE.KEROSENE} />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Себестоимость:{" "}
              <span className="font-medium">{formatCurrency(cost)}/кг</span>
            </span>
          </div>
        </div>

        {pvkjBalance > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-semibold text-muted-foreground">
                  {formatNumber(pvkjBalance)} кг
                </span>
                <ProductTypeBadge type={PRODUCT_TYPE.PVKJ} />
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Себестоимость:{" "}
                  <span className="font-medium">
                    {formatCurrency(pvkjCost)}/кг
                  </span>
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={(e) => {
          e?.stopPropagation();
          deleteMutation.mutate(equipment.id);
          setDeleteDialogOpen(false);
        }}
        title="Удалить оборудование?"
        description="Вы уверены, что хотите удалить это средство заправки? Это действие нельзя отменить."
        itemName={equipment.name}
      />
    </Card>
  );
}
