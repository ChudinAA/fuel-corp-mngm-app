import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { EntityActionsMenu } from "@/components/entity-actions-menu";
import { AuditPanel } from "@/components/audit-panel";
import { Pencil, Trash2, Search, MapPin, History } from "lucide-react";
import { BaseFormDialog } from "./bases-dialog";
import type { Base } from "@shared/schema";
import { BASE_TYPE } from "@shared/constants";
import { useAuth } from "@/hooks/use-auth";

export function BasesTab() {
  const [search, setSearch] = useState("");
  const [editingBase, setEditingBase] = useState<Base | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [baseToDelete, setBaseToDelete] = useState<Base | null>(null);
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);
  const { toast } = useToast();
  const { hasPermission } = useAuth();

  const { data: bases, isLoading } = useQuery<Base[]>({
    queryKey: ["/api/bases"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/bases/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bases"] });
      toast({ title: "Базис удален", description: "Базис успешно удален из справочника" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const filteredBases = bases?.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || b.baseType === typeFilter;
    return matchesSearch && matchesType;
  }) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Базисы
        </CardTitle>
        <CardDescription>Управление базисами поставки и заправки</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="pl-9" 
                data-testid="input-search-bases" 
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="w-[180px]" data-testid="select-base-type-filter">
                <SelectValue placeholder="Все типы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value={BASE_TYPE.WHOLESALE}>ОПТ</SelectItem>
                <SelectItem value={BASE_TYPE.REFUELING}>Заправка</SelectItem>
              </SelectContent>
            </Select>
            {hasPermission("directories", "create") && <AddBaseDialog editItem={editingBase} onEditComplete={() => setEditingBase(null)} />}
            <Button
              variant="outline"
              onClick={() => setAuditPanelOpen(true)}
              title="Аудит всех базисов"
            >
              <History className="h-4 w-4 mr-2" />
              История изменений
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Местоположение</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Нет данных
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBases.map((base) => (
                      <TableRow key={base.id} data-testid={`row-base-${base.id}`}>
                        <TableCell className="font-medium">{base.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="flex items-center gap-1.5 w-fit">
                            {base.baseType === BASE_TYPE.WHOLESALE ? (
                              <>
                                <Droplets className="h-3.5 w-3.5 text-orange-400" />
                                <span>ОПТ</span>
                              </>
                            ) : (
                              <>
                                <Fuel className="h-3.5 w-3.5 text-green-400" />
                                <span>Заправка</span>
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{base.location || "—"}</TableCell>
                        <TableCell>
                          {base.isActive ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">Активен</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Неактивен</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <EntityActionsMenu
                            actions={[
                              {
                                id: "edit",
                                label: "Редактировать",
                                icon: Pencil,
                                onClick: () => setEditingItem(base),
                                permission: { module: "directories", action: "edit" },
                              },
                              {
                                id: "delete",
                                label: "Удалить",
                                icon: Trash2,
                                onClick: () => {
                                  setItemToDelete({ id: base.id, name: base.name });
                                  setDeleteDialogOpen(true);
                                },
                                variant: "destructive" as const,
                                permission: { module: "directories", action: "delete" },
                                separatorAfter: true,
                              },
                            ]}
                            audit={{
                              entityType: "bases",
                              entityId: base.id,
                              entityName: base.name,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
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
          if (itemToDelete) {
            deleteMutation.mutate(itemToDelete.id);
          }
          setDeleteDialogOpen(false);
          setItemToDelete(null);
        }}
        title="Удалить базис?"
        description="Вы уверены, что хотите удалить этот базис? Это действие нельзя отменить."
        itemName={itemToDelete?.name}
      />

      <AuditPanel
        open={auditPanelOpen}
        onOpenChange={setAuditPanelOpen}
        entityType="bases"
        entityId=""
      />
    </Card>
  );
}