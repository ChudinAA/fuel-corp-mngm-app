
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Search, Filter, Plus } from "lucide-react";
import type { Exchange, Warehouse } from "@shared/schema";
import { ExchangeDialog } from "./exchange/components/exchange-dialog";
import { ExchangeTable } from "./exchange/components/exchange-table";

export default function ExchangePage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editingExchange, setEditingExchange] = useState<Exchange | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const pageSize = 10;

  const { data: warehouses } = useQuery<Warehouse[]>({
    queryKey: ["/api/warehouses"],
  });

  const { data: exchanges, isLoading } = useQuery<{ data: Exchange[]; total: number }>({
    queryKey: ["/api/exchange", page, search],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/exchange/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: "Сделка удалена", description: "Биржевая сделка успешно удалена" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const data = exchanges?.data || [];
  const total = exchanges?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const handleEditClick = (exchange: Exchange) => {
    setEditingExchange(exchange);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingExchange(null);
  };

  const handleOpenDialog = () => {
    setEditingExchange(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Биржа</h1>
          <p className="text-muted-foreground">
            Учет биржевых сделок с автоматическим обновлением складов
          </p>
        </div>
        <Button onClick={handleOpenDialog} data-testid="button-add-exchange">
          <Plus className="mr-2 h-4 w-4" />
          Новая сделка
        </Button>
      </div>

      <ExchangeDialog 
        warehouses={warehouses || []} 
        editExchange={editingExchange}
        open={isDialogOpen}
        onOpenChange={(open) => !open && handleCloseDialog()}
      />

      <Card>
        <CardHeader>
          <CardTitle>Список биржевых сделок</CardTitle>
          <CardDescription>История сделок с биржей</CardDescription>
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
                  data-testid="input-search-exchange" 
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            <ExchangeTable
              data={data}
              isLoading={isLoading}
              onEdit={handleEditClick}
              onDelete={(id) => deleteMutation.mutate(id)}
              isDeletingId={deleteMutation.isPending ? deleteMutation.variables : undefined}
            />

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Показано {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} из {total}
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    disabled={page === 1} 
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">{page} / {totalPages}</span>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    disabled={page === totalPages} 
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
