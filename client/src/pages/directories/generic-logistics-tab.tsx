import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Pencil,
  Trash2,
  MapPin,
  Building2,
  Car,
  Container,
  User,
  Truck,
} from "lucide-react";
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
  });

  const getItemDisplayName = (item: any): string => {
    if (type === "vehicle" || type === "trailer") return item.regNumber;
    if (type === "driver") return item.fullName;
    return item.name;
  };

  const filteredItems =
    items?.filter((item) =>
      getItemDisplayName(item).toLowerCase().includes(search.toLowerCase()),
    ) || [];

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
                  <TableRow>
                    <TableHead>Название</TableHead>
                    {type === "delivery_location" && <TableHead>Базис</TableHead>}
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {getItemDisplayName(item)}
                      </TableCell>
                      {type === "delivery_location" && (
                        <TableCell>
                          {(() => {
                            const base = bases.find((b) => b.id === item.baseId);
                            return base ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{base.name}</span>
                                <BaseTypeBadge type={base.baseType} />
                              </div>
                            ) : (
                              "—"
                            );
                          })()}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            item.isActive
                              ? "text-green-600 border-green-600"
                              : ""
                          }
                        >
                          {item.isActive ? "Активен" : "Неактивен"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <EntityActionsMenu
                          actions={[
                            {
                              id: "edit",
                              label: "Редактировать",
                              icon: Pencil,
                              onClick: () =>
                                setEditingItem({ type, data: item }),
                              permission: {
                                module: "directories",
                                action: "delete",
                              },
                            },
                            {
                              id: "delete",
                              label: "Удалить",
                              icon: Trash2,
                              onClick: () => {
                                setItemToDelete({
                                  id: item.id,
                                  name: getItemDisplayName(item),
                                });
                                setDeleteDialogOpen(true);
                              },
                              variant: "destructive",
                              permission: {
                                module: "directories",
                                action: "delete",
                              },
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
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
        }}
        itemName={itemToDelete?.name}
      />
    </Card>
  );
}
