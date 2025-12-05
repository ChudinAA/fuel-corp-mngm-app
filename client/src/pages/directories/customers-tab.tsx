
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
import { Search, Users, Pencil, Trash2 } from "lucide-react";
import type { Customer } from "@shared/schema";
import { AddCustomerDialog } from "./customers-dialog";

export function CustomersTab() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

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
          <div className="flex items-center gap-4 flex-wrap">
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
            <AddCustomerDialog />
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
                            {item.module === "wholesale" ? "ОПТ" : item.module === "refueling" ? "Заправка" : "Общий"}
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
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              data-testid={`button-edit-customer-${item.id}`}
                              onClick={() => {
                                toast({ title: "В разработке", description: "Функция редактирования в разработке" });
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive" 
                              data-testid={`button-delete-customer-${item.id}`}
                              onClick={() => {
                                if (confirm("Вы уверены, что хотите удалить этого покупателя?")) {
                                  deleteMutation.mutate(item.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
    </Card>
  );
}
