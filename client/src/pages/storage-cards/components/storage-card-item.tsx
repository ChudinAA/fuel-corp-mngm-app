import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Pencil, Trash2, CreditCard, MapPin, Plane, DollarSign } from "lucide-react";
import { EntityActionsMenu } from "@/components/entity-actions-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface StorageCard {
  id: string;
  name: string;
  country: string;
  airport: string;
  airportCode: string | null;
  currency: string | null;
  currentBalance: string | null;
  averageCost: string | null;
  averageCostCurrency: string | null;
  storageCost: string | null;
  notes: string | null;
  isActive: boolean | null;
  createdAt: string | null;
}

interface StorageCardItemProps {
  card: StorageCard;
  onEdit: (card: StorageCard) => void;
  onViewDetails: (card: StorageCard) => void;
}

const formatNumber = (value: string | number | null, decimals = 2) => {
  if (value === null || value === undefined) return "0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(num) ? "0" : num.toLocaleString("ru-RU", { 
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals 
  });
};

const formatCurrency = (value: string | number | null, currency = "USD") => {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num) || num === 0) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: currency === "RUB" ? "RUB" : "USD",
    maximumFractionDigits: 4,
  }).format(num);
};

export function StorageCardItem({ card, onEdit, onViewDetails }: StorageCardItemProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const balance = parseFloat(card.currentBalance || "0");
  const cost = parseFloat(card.averageCost || "0");
  const isInactive = card.isActive === false;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/storage-cards/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage-cards"] });
      toast({ title: "Карта хранения удалена" });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить карту хранения",
        variant: "destructive",
      });
    },
  });

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${isInactive ? "opacity-60" : ""}`}
      onClick={() => onViewDetails(card)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-sky-400 shrink-0" />
              <span className="truncate">{card.name}</span>
              {isInactive && <Badge variant="destructive">Неактивна</Badge>}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {card.country}
              </span>
              <span className="flex items-center gap-1">
                <Plane className="h-3 w-3" />
                {card.airport}
                {card.airportCode && ` (${card.airportCode})`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <EntityActionsMenu
              actions={[
                {
                  id: "edit",
                  label: "Редактировать",
                  icon: Pencil,
                  onClick: () => onEdit(card),
                  permission: { module: "storage-cards", action: "edit" },
                },
                {
                  id: "delete",
                  label: "Удалить",
                  icon: Trash2,
                  onClick: () => setDeleteDialogOpen(true),
                  variant: "destructive" as const,
                  permission: { module: "storage-cards", action: "delete" },
                  separatorAfter: true,
                },
              ]}
              audit={{
                entityType: "storage_cards",
                entityId: card.id,
                entityName: card.name,
              }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold">
              {formatNumber(balance, 0)} кг
            </span>
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {card.currency || "USD"}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Себестоимость:{" "}
              <span className="font-medium">
                {formatCurrency(cost, card.averageCostCurrency || card.currency || "USD")}/кг
              </span>
            </span>
          </div>
          {card.storageCost && parseFloat(card.storageCost) > 0 && (
            <div className="text-sm text-muted-foreground">
              Стоимость хранения: {formatCurrency(card.storageCost, card.currency || "USD")}
            </div>
          )}
        </div>
      </CardContent>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={(e) => {
          e?.stopPropagation();
          deleteMutation.mutate(card.id);
          setDeleteDialogOpen(false);
        }}
        title="Удалить карту хранения?"
        description="Вы уверены, что хотите удалить эту карту хранения? Это действие нельзя отменить."
        itemName={card.name}
      />
    </Card>
  );
}
