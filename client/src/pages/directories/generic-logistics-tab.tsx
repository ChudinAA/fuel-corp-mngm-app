import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useErrorModal } from "@/hooks/use-error-modal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Pencil, Trash2 } from "lucide-react";
import { EntityActionsMenu } from "@/components/entity-actions-menu";
import { AddLogisticsDialog } from "./logistics-dialog";
import { useAuth } from "@/hooks/use-auth";
import { BaseTypeBadge } from "@/components/base-type-badge";
import type { Base } from "@shared/schema";

interface GenericLogisticsTabProps {
  type: "carrier" | "delivery_location" | "vehicle" | "trailer" | "driver";
  title: string;
  description: string;
  icon: any;
}

export function GenericLogisticsTab({
  type,
  title,
  description,
  icon: Icon,
}: GenericLogisticsTabProps) {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<{
    type: string;
    data: any;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const { toast } = useToast();
  const { showError, ErrorModalComponent } = useErrorModal();

  const queryKeys: Record<string, string> = {
    carrier: "/api/logistics/carriers",
    delivery_location: "/api/logistics/delivery-locations",
    vehicle: "/api/logistics/vehicles",
    trailer: "/api/logistics/trailers",
    driver: "/api/logistics/drivers",
  };

  const { data: items, isLoading } = useQuery<any[]>({
    queryKey: [queryKeys[type]],
  });

  const { data: carriers = [] } = useQuery<any[]>({
    queryKey: ["/api/logistics/carriers"],
  });

  const { data: bases = [] } = useQuery<Base[]>({
    queryKey: ["/api/bases"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `${queryKeys[type]}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeys[type]] });
      toast({ title: "Запись удалена" });
    },
    onError: () => showError("Не удалось удалить запись"),
  });

  const getItemDisplayName = (item: any): string => {
    if (type === "vehicle" || type === "trailer") return item.regNumber;
    if (type === "driver") return item.fullName;
    return item.name;
  };

  const carrierById = new Map<string, any>(carriers.map((c: any) => [c.id, c]));

  const filteredItems =
    items?.filter((item) =>
      getItemDisplayName(item).toLowerCase().includes(search.toLowerCase()),
    ) || [];

  // ─── Column definitions per type ──────────────────────────────────────────

  const renderHeaders = () => {
    switch (type) {
      case "carrier":
        return (
          <>
            <TableHead>Название</TableHead>
            <TableHead>ИНН</TableHead>
            <TableHead>Описание</TableHead>
            <TableHead className="w-[64px]" />
          </>
        );
      case "delivery_location":
        return (
          <>
            <TableHead>Название</TableHead>
            <TableHead>Базис</TableHead>
            <TableHead>Адрес</TableHead>
            <TableHead className="w-[64px]" />
          </>
        );
      case "vehicle":
        return (
          <>
            <TableHead>Перевозчик</TableHead>
            <TableHead>Гос. номер</TableHead>
            <TableHead>Модель / тип</TableHead>
            <TableHead className="text-right">Вмест., кг</TableHead>
            <TableHead className="w-[64px]" />
          </>
        );
      case "trailer":
        return (
          <>
            <TableHead>Перевозчик</TableHead>
            <TableHead>Гос. номер</TableHead>
            <TableHead className="text-right">Вмест., кг</TableHead>
            <TableHead className="w-[64px]" />
          </>
        );
      case "driver":
        return (
          <>
            <TableHead>Перевозчик</TableHead>
            <TableHead>ФИО</TableHead>
            <TableHead>Телефон</TableHead>
            <TableHead>№ удостоверения</TableHead>
            <TableHead className="w-[64px]" />
          </>
        );
    }
  };

  const renderRow = (item: any) => {
    const actions = [
      {
        id: "edit",
        label: "Редактировать",
        icon: Pencil,
        onClick: () => setEditingItem({ type, data: item }),
        permission: { module: "directories" as const, action: "edit" as const },
      },
      {
        id: "delete",
        label: "Удалить",
        icon: Trash2,
        onClick: () => {
          setItemToDelete({ id: item.id, name: getItemDisplayName(item) });
          setDeleteDialogOpen(true);
        },
        variant: "destructive" as const,
        permission: { module: "directories" as const, action: "delete" as const },
      },
    ];

    const actionCell = (
      <TableCell>
        <EntityActionsMenu actions={actions} />
      </TableCell>
    );

    switch (type) {
      case "carrier":
        return (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.name}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{item.inn || "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
              {item.description || "—"}
            </TableCell>
            {actionCell}
          </TableRow>
        );

      case "delivery_location": {
        const base = bases.find((b) => b.id === item.baseId);
        return (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.name}</TableCell>
            <TableCell>
              {base ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm">{base.name}</span>
                  <BaseTypeBadge type={base.baseType} />
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{item.address || "—"}</TableCell>
            {actionCell}
          </TableRow>
        );
      }

      case "vehicle":
        return (
          <TableRow key={item.id}>
            <TableCell className="text-sm">
              {carrierById.get(item.carrierId)?.name || (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="font-medium">{item.regNumber}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{item.model || "—"}</TableCell>
            <TableCell className="text-right tabular-nums text-sm">
              {item.capacityKg
                ? parseFloat(item.capacityKg).toLocaleString("ru")
                : <span className="text-muted-foreground">—</span>}
            </TableCell>
            {actionCell}
          </TableRow>
        );

      case "trailer":
        return (
          <TableRow key={item.id}>
            <TableCell className="text-sm">
              {carrierById.get(item.carrierId)?.name || (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="font-medium">{item.regNumber}</TableCell>
            <TableCell className="text-right tabular-nums text-sm">
              {item.capacityKg
                ? parseFloat(item.capacityKg).toLocaleString("ru")
                : <span className="text-muted-foreground">—</span>}
            </TableCell>
            {actionCell}
          </TableRow>
        );

      case "driver":
        return (
          <TableRow key={item.id}>
            <TableCell className="text-sm">
              {carrierById.get(item.carrierId)?.name || (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="font-medium">{item.fullName}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{item.phone || "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground font-mono">
              {item.licenseNumber || "—"}
            </TableCell>
            {actionCell}
          </TableRow>
        );
    }
  };

  const colSpan = type === "driver" ? 5 : type === "vehicle" ? 5 : type === "trailer" ? 4 : 4;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {hasPermission("directories", "create") && (
              <AddLogisticsDialog
                carriers={carriers}
                editItem={editingItem}
                onEditComplete={() => setEditingItem(null)}
                defaultType={type}
              />
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>{renderHeaders()}</TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={colSpan}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Нет записей
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => renderRow(item))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (itemToDelete) deleteMutation.mutate(itemToDelete.id);
          setDeleteDialogOpen(false);
          setItemToDelete(null);
        }}
        itemName={itemToDelete?.name}
      />
      <ErrorModalComponent />
    </Card>
  );
}
