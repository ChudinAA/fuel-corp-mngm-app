
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, BookOpen, Building2, Pencil, Trash2 } from "lucide-react";
import type { WholesaleSupplier, WholesaleBase } from "@shared/schema";
import { AddWholesaleDialog } from "./wholesale-dialog";

const WHOLESALE_TYPES = [
  { value: "supplier", label: "Поставщик", icon: Building2 },
  { value: "basis", label: "Базис поставки", icon: Building2 },
] as const;

type WholesaleType = typeof WHOLESALE_TYPES[number]["value"];

export function WholesaleTab() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<WholesaleType | "all">("all");

  const { data: suppliers, isLoading: suppliersLoading } = useQuery<WholesaleSupplier[]>({
    queryKey: ["/api/wholesale/suppliers"],
  });

  const { data: bases, isLoading: basesLoading } = useQuery<WholesaleBase[]>({
    queryKey: ["/api/wholesale/bases"],
  });

  const isLoading = suppliersLoading || basesLoading;

  const allItems = [
    ...(suppliers?.map(s => ({ ...s, type: "supplier" as const, typeName: "Поставщик" })) || []),
    ...(bases?.map(b => ({ ...b, type: "basis" as const, typeName: "Базис" })) || []),
  ];

  const filteredItems = allItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getSupplierName = (supplierId: string | null | undefined) => {
    if (!supplierId) return null;
    return suppliers?.find(s => s.id === supplierId)?.name || null;
  };

  const getBaseName = (baseId: string | null | undefined) => {
    if (!baseId) return null;
    return bases?.find(b => b.id === baseId)?.name || null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Справочник ОПТ
        </CardTitle>
        <CardDescription>Поставщики, покупатели и базисы для оптовых операций</CardDescription>
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
                data-testid="input-search-wholesale" 
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as WholesaleType | "all")}>
              <SelectTrigger className="w-[180px]" data-testid="select-wholesale-type-filter">
                <SelectValue placeholder="Все типы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                {WHOLESALE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AddWholesaleDialog suppliers={suppliers || []} bases={bases || []} />
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
                    <TableHead className="w-[140px]">Тип</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Базис поставки</TableHead>
                    <TableHead>Доп. информация</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Нет данных
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={`${item.type}-${item.id}`} data-testid={`row-wholesale-${item.type}-${item.id}`}>
                        <TableCell>
                          <Badge variant="outline">{item.typeName}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          {item.type === "supplier" 
                            ? getBaseName((item as WholesaleSupplier & { type: string }).defaultBaseId) || "—"
                            : item.type === "basis" 
                              ? getSupplierName((item as WholesaleBase & { type: string }).supplierId) || "—"
                              : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {item.type === "supplier" 
                            ? (item as WholesaleSupplier & { type: string }).inn || "—" 
                            : (item as WholesaleBase & { type: string }).location || "—"}
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
                            <Button variant="ghost" size="icon" data-testid={`button-edit-${item.type}-${item.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" data-testid={`button-delete-${item.type}-${item.id}`}>
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
