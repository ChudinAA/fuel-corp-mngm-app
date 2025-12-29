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
import { Pencil, Trash2, Search, Users, History } from "lucide-react";
import { CustomerFormDialog } from "./customers-dialog";
import type { Customer } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

export function CustomersTab() {
  const [search, setSearch] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);
  const { toast } = useToast();
  const { hasPermission } = useAuth();

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/customers/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Покупатель удален", description: "Покупатель успешно удален из справочника" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const filteredItems = customers?.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Справочник Покупатели
        </CardTitle>
        <CardDescription>Единый справочник покупателей для ОПТ и Заправки ВС</CardDescription>
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
                data-testid="input-search-customers" 
              />
            </div>
            {hasPermission("directories", "create") && (
              <AddCustomerDialog editCustomer={editingCustomer} onEditComplete={() => setEditingCustomer(null)} />
            )}
            <Button
              variant="outline"
              onClick={() => setAuditPanelOpen(true)}
              title="Аудит всех покупателей"
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
                    <TableHead>Модуль</TableHead>
                    <TableHead>Контактное лицо</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Нет данных
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={item.id} data-testid={`row-customer-${item.id}`}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {item.module === CUSTOMER_MODULE.WHOLESALE ? "ОПТ" : item.module === CUSTOMER_MODULE.REFUELING ? "Заправка" : "Общий"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.contactPerson || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{item.phone || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{item.email || "—"}</TableCell>
                        <TableCell>
                          {item.isActive ? (
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
                                onClick: () => setEditingCustomer(item),
                                permission: { module: "directories", action: "edit" },
                              },
                              {
                                id: "delete",
                                label: "Удалить",
                                icon: Trash2,
                                onClick: () => {
                                  setCustomerToDelete(item);
                                  setDeleteDialogOpen(true);
                                },
                                variant: "destructive" as const,
                                permission: { module: "directories", action: "delete" },
                                separatorAfter: true,
                              },
                            ]}
                            audit={{
                              entityType: "customers",
                              entityId: item.id,
                              entityName: item.name,
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

        <AuditPanel 
          isOpen={auditPanelOpen} 
          onClose={() => setAuditPanelOpen(false)} 
          entityType="customers" 
        />
      </CardContent>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (customerToDelete) {
            deleteMutation.mutate(customerToDelete.id);
          }
          setDeleteDialogOpen(false);
          setCustomerToDelete(null);
        }}
        title="Удалить покупателя?"
        description="Вы уверены, что хотите удалить этого покупателя? Это действие нельзя отменить."
        itemName={customerToDelete?.name}
      />
    </Card>
  );
}