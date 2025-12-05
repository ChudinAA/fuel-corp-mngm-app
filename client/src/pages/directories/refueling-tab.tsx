
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plane, Pencil, Trash2 } from "lucide-react";
import type { RefuelingProvider, RefuelingBase } from "@shared/schema";
import { AddRefuelingDialog } from "./refueling-dialog";

const REFUELING_TYPES = [
  { value: "provider", label: "Аэропорт/Поставщик", icon: Plane },
  { value: "basis", label: "Базис заправки", icon: Plane },
] as const;

type RefuelingType = typeof REFUELING_TYPES[number]["value"];

export function RefuelingTab() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<RefuelingType | "all">("all");
  const [editingItem, setEditingItem] = useState<{ type: "provider" | "basis"; data: any } | null>(null);
  const { toast } = useToast();

  const { data: providers, isLoading: providersLoading } = useQuery<RefuelingProvider[]>({
    queryKey: ["/api/refueling/providers"],
  });

  const { data: bases = [] } = useQuery<RefuelingBase[]>({
    queryKey: ["/api/refueling/bases"],
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      const endpoint = type === "provider" ? `/api/refueling/providers/${id}` : `/api/refueling/bases/${id}`;
      const res = await apiRequest("DELETE", endpoint);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/refueling/providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/refueling/bases"] });
      toast({ title: "Запись удалена", description: "Запись успешно удалена из справочника" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const isLoading = providersLoading;

  const allItems = [
    ...(providers?.map(p => ({ ...p, type: "provider" as const, typeName: "Аэропорт/Поставщик" })) || []),
    ...(bases?.map(b => ({ ...b, type: "basis" as const, typeName: "Базис" })) || []),
  ];

  const filteredItems = allItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getBaseName = (baseId: string | null | undefined) => {
    if (!baseId) return null;
    return bases?.find(b => b.id === baseId)?.name || null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plane className="h-5 w-5" />
          Справочник Заправка ВС
        </CardTitle>
        <CardDescription>Аэропорты, поставщики и базисы для заправки воздушных судов</CardDescription>
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
                data-testid="input-search-refueling" 
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as RefuelingType | "all")}>
              <SelectTrigger className="w-[200px]" data-testid="select-refueling-type-filter">
                <SelectValue placeholder="Все типы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                {REFUELING_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AddRefuelingDialog providers={providers || []} bases={bases || []} editItem={editingItem} />
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
                    <TableHead className="w-[160px]">Тип</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Базис заправки</TableHead>
                    <TableHead>Доп. информация</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <Plane className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Нет данных
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={`${item.type}-${item.id}`} data-testid={`row-refueling-${item.type}-${item.id}`}>
                        <TableCell>
                          <Badge variant="outline">{item.typeName}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          {item.type === "provider" 
                            ? getBaseName((item as RefuelingProvider & { type: string }).defaultBaseId) 
                            : item.type === "basis"
                              ? "—"
                              : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {item.type === "provider" 
                            ? (item as RefuelingProvider & { type: string }).icaoCode || "—"
                            : (item as RefuelingBase & { type: string }).location || "—"}
                        </TableCell>
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
                              data-testid={`button-edit-${item.type}-${item.id}`}
                              onClick={() => setEditingItem({ type: item.type, data: item })}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive" 
                              data-testid={`button-delete-${item.type}-${item.id}`}
                              onClick={() => {
                                if (confirm("Вы уверены, что хотите удалить эту запись?")) {
                                  deleteMutation.mutate({ type: item.type, id: item.id });
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
